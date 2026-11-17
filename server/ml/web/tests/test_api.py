import copy
import pytest
from fastapi.testclient import TestClient
from web.main import app


@pytest.fixture(scope='module')
def client():
    with TestClient(app) as c:
        yield c


def payload(client, *, correct=True, missing=False, topic_index=0, post=False):
    topic = client.app.state.engine.instrument['topics'][topic_index]
    items = topic['items'][15:] if post else topic['items'][:15]
    return {'topic_id': topic['id'], 'student_id': 'SYN-API',
            'responses': [{'question_id': q['id'], 'answer_option': None if missing else q['answer'] if correct else (q['answer']+1)%4,
                           'content_hash': q['contentHash']} for q in items]}


def test_openapi_schemas_and_models(client):
    assert client.get('/docs').status_code == 200
    spec = client.get('/openapi.json').json()
    assert spec['components']['securitySchemes']['APIKeyHeader']['name'] == 'X-Service-Key'
    assert 'answer_option' in spec['components']['schemas']['ResponseItem']['properties']
    assert 'posteriorSd' in spec['components']['schemas']['Attribute']['properties']
    models = client.get('/v1/models').json()
    assert {m['id'] for m in models} == {'edubridge', 'calculus', 'eedi'}
    assert next(m for m in models if m['id']=='edubridge')['items'] == 180


@pytest.mark.parametrize('index', range(6))
def test_all_topics_use_frozen_pdina(client, index):
    before = client.app.state.engine.services['edubridge'].model.g.copy()
    r = client.post('/v1/diagnose', json=payload(client, topic_index=index))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['score'] == 100 and d['gapCount'] == 0
    assert d['provider'] == 'pdina' and d['simulated'] is False and d['calibrationSynthetic'] is True
    assert all(a['evidence']==5 and a['label']=='mastered' for a in d['attributes'])
    assert (before == client.app.state.engine.services['edubridge'].model.g).all()


def test_blank_is_not_wrong_and_not_a_gap(client):
    blank = client.post('/v1/diagnose', json=payload(client, missing=True)).json()
    wrong = client.post('/v1/diagnose', json=payload(client, correct=False)).json()
    assert blank['gapCount'] == 0 and blank['insufficientCount'] == 3 and blank['observedCount'] == 0
    assert all(a['mastery'] is None and a['evidence']==0 for a in blank['attributes'])
    assert wrong['gapCount'] == 3 and wrong['observedCount'] == 15


def test_changed_items_are_excluded_and_unknown_items_rejected(client):
    body = payload(client)
    body['responses'][0]['content_hash'] = '0'*64
    result = client.post('/v1/diagnose', json=body).json()
    assert result['unsupportedItemIds'] == [body['responses'][0]['question_id']]
    assert result['attributes'][0]['evidence']==4 and result['attributes'][0]['label']=='insufficient_evidence'
    body['responses'][0]['question_id'] = 'fake-id'
    assert client.post('/v1/diagnose', json=body).status_code == 422


@pytest.mark.parametrize('change', ['duplicate', 'range', 'topic', 'extra'])
def test_invalid_requests(client, change):
    body = payload(client)
    if change=='duplicate': body['responses'].append(copy.deepcopy(body['responses'][0]))
    elif change=='range': body['responses'][0]['answer_option']=4
    elif change=='topic': body['topic_id']='not-a-topic'
    else: body['provider']='pretend'
    assert client.post('/v1/diagnose', json=body).status_code == 422


def test_pre_post_changes_are_matched(client):
    pre, post = payload(client, correct=False), payload(client, post=True)
    response = client.post('/v1/compare', json={'pre': pre, 'post': post})
    assert response.status_code == 200
    assert response.json()['gapsClosed']==3 and response.json()['scoreChange']==100
    post['student_id']='another-student'
    assert client.post('/v1/compare', json={'pre': pre, 'post': post}).status_code == 422


def test_narrative_fallback_is_validated_and_tutor_without_credentials(client):
    r=client.post('/v1/narrative', json=payload(client))
    assert r.status_code==200, r.text
    d=r.json()
    assert d['fallback'] and d['validation']['ok'] and 'Ringkasan' in d['text']
    tutor=client.post('/v1/tutor', json={'topic_id':'fungsi', 'message':'Jelaskan invers fungsi'}).json()
    assert tutor['fallback'] and tutor['provider']=='lesson-content' and not tutor['simulated']


def test_service_authentication(client, monkeypatch):
    monkeypatch.setenv('AI_SERVICE_KEY', 'unit-secret-key')
    assert client.get('/v1/models').status_code==401
    assert client.get('/v1/models', headers={'X-Service-Key':'wrong'}).status_code==401
    assert client.get('/v1/models', headers={'X-Service-Key':'unit-secret-key'}).status_code==200
    assert client.get('/health').status_code==200


def test_tutor_transport_failures_do_not_leak_provider_secrets(client, monkeypatch):
    engine=client.app.state.engine
    monkeypatch.setattr(engine.config, 'enabled', True)
    monkeypatch.setenv('GEMINI_API_KEY', 'fake-test-only')
    def bad_transport(payload): raise RuntimeError('SECRET-provider-key')
    monkeypatch.setattr(engine, 'tutor_transport', bad_transport)
    r=client.post('/v1/tutor', json={'topic_id':'fungsi','message':'Bantu komposisi'})
    assert r.status_code==200 and r.json()['fallback']
    assert 'SECRET' not in r.text


def test_model_version_mismatch_is_rejected(client):
    body=payload(client)
    body['expected_model_version']='obsolete-model'
    assert client.post('/v1/narrative', json=body).status_code==422


def test_invalid_json_and_nonfinite_numbers_are_rejected(client):
    assert client.post('/v1/diagnose',content='{"response":NaN}',headers={'Content-Type':'application/json'}).status_code==400
    assert client.post('/v1/diagnose',content='{bad',headers={'Content-Type':'application/json'}).status_code==400
    assert client.post('/v1/diagnose',content='x').status_code==415


def test_class_narrative_aggregates_only_the_requested_topic(client):
    first=payload(client, correct=False)
    second=payload(client)
    second['student_id']='SYN-OTHER'
    body={'topic_id':'fungsi','students':[{'student_id':p['student_id'],'responses':p['responses']} for p in [first,second]]}
    response=client.post('/v1/class-narrative',json=body)
    assert response.status_code==200, response.text
    assert response.json()['validation']['ok']
    assert 'Ringkasan kelas' in response.json()['text']
    assert 'Rotasi' not in response.json()['text']


def test_tutor_uses_configured_transport_without_sending_account_identity(client, monkeypatch):
    engine=client.app.state.engine
    monkeypatch.setattr(engine.config,'enabled',True)
    monkeypatch.setenv('GEMINI_API_KEY','fake-test-only')
    seen=[]
    def transport(payload):
        seen.append(payload)
        return {'text':'Komposisi berarti memasukkan keluaran fungsi pertama ke fungsi berikutnya.'}
    monkeypatch.setattr(engine,'tutor_transport',transport)
    response=client.post('/v1/tutor',json={'topic_id':'fungsi','message':'Bantu email saya siswa@example.id memahami komposisi.'})
    assert response.status_code==200 and response.json()['provider']=='gemini'
    assert not response.json()['fallback']
    assert 'siswa@example.id' not in str(seen)
    assert 'answer_key' not in str(seen) and 'correct_answer' not in str(seen)


def test_tutor_reflects_the_current_admin_lesson(client):
    original=client.app.state.engine.topics['fungsi']
    lesson={'title':original['title'],'blocks':[{k:b[k] for k in ['title','body','example']} for b in original['blocks']]}
    lesson['blocks'][0]['body']='Materi terbaru yang telah diperbarui oleh guru kelas.'
    response=client.post('/v1/tutor',json={'topic_id':'fungsi','message':'Bantu memahami evaluasi','lesson':lesson})
    assert response.status_code==200
    assert 'Materi terbaru yang telah diperbarui oleh guru kelas.' in response.json()['message']
