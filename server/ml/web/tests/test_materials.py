import copy
import json
import pytest
from fastapi.testclient import TestClient
from web.main import app


@pytest.fixture(scope='module')
def client():
    with TestClient(app) as client:
        yield client


def sample(client, count=1):
    topic = client.app.state.engine.topics['fungsi']
    block = {k: copy.deepcopy(topic['blocks'][0][k]) for k in ['title','body','example','sections','worked','misconception','practice']}
    block['practice'] = [{k:p[k] for k in ['question','answer','explanation']} for p in block['practice']]
    return dict(title='Penguatan fungsi kelas XI', summary='Penjelasan fungsi secara bertahap untuk memperkuat konsep siswa.', minutes=20, blocks=[copy.deepcopy(block) for _ in range(count)])


def enabled(client, monkeypatch):
    generator = client.app.state.engine.material_generator
    monkeypatch.setattr(generator.config, 'enabled', True)
    monkeypatch.setenv('GEMINI_API_KEY', 'fake-test-only')
    return generator


def test_structured_draft_schema_context_redaction_and_unique_practice_ids(client, monkeypatch):
    generator = enabled(client, monkeypatch)
    seen=[]
    def transport(payload):
        seen.append(payload)
        return {'text':json.dumps(sample(client, 2)),'finish_reason':'STOP'}
    monkeypatch.setattr(generator,'transport',transport)
    response=client.post('/v1/materials/generate',json=dict(topic_id='fungsi',block_count=2,instructions='Contoh untuk guru@example.id, bukan data siswa.'))
    assert response.status_code==200, response.text
    data=response.json()
    assert data['requiresReview'] is True and data['status']=='draft' and data['provider']=='gemini'
    assert len(data['draft']['blocks'])==2
    ids=[p['id'] for b in data['draft']['blocks'] for p in b['practice']]
    assert len(ids)==len(set(ids))
    assert seen[0]['response_mime_type']=='application/json'
    assert 'properties' in seen[0]['response_json_schema']
    prompt=str(seen[0]['messages'])
    assert 'guru@example.id' not in prompt
    assert 'answer_option' not in prompt and 'contentHash' not in prompt
    spec=client.get('/openapi.json').json()
    op=spec['paths']['/v1/materials/generate']['post']
    assert 'requestBody' in op and '200' in op['responses'] and '502' in op['responses']


@pytest.mark.parametrize('kind',['json','html','truncated','wrong_count','bad_steps','provider'])
def test_invalid_or_failed_generation_is_rejected_without_leaking_provider_data(client, monkeypatch, kind):
    generator=enabled(client,monkeypatch)
    def transport(payload):
        data=sample(client)
        if kind=='provider': raise RuntimeError('SECRET-provider-token')
        if kind=='html':data['blocks'][0]['body']='<script>alert("SECRET")</script>'
        if kind=='wrong_count':data['blocks']=data['blocks']*2
        if kind=='bad_steps':data['blocks'][0]['worked']['steps']=['x']
        return {'text':'SECRET invalid JSON' if kind=='json' else json.dumps(data), 'finish_reason':'MAX_TOKENS' if kind=='truncated' else 'STOP'}
    monkeypatch.setattr(generator,'transport',transport)
    response=client.post('/v1/materials/generate',json={'topic_id':'fungsi','block_count':1})
    assert response.status_code==502
    assert 'SECRET' not in response.text


def test_disabled_generator_never_synthesizes_fake_ai_output(client,monkeypatch):
    monkeypatch.setattr(client.app.state.engine.material_generator.config,'enabled',False)
    response=client.post('/v1/materials/generate',json={'topic_id':'fungsi'})
    assert response.status_code==503 and 'draft' not in response.json()


def test_generation_request_validation_and_service_auth(client,monkeypatch):
    assert client.post('/v1/materials/generate',json={'topic_id':'unknown'}).status_code==422
    assert client.post('/v1/materials/generate',json={'topic_id':'fungsi','block_count':7}).status_code==422
    assert client.post('/v1/materials/generate',json={'topic_id':'fungsi','instructions':'x'*1001}).status_code==422
    monkeypatch.setenv('AI_SERVICE_KEY','test-material-service-key')
    assert client.post('/v1/materials/generate',json={'topic_id':'fungsi'}).status_code==401
