"""FastAPI/Swagger inference boundary. Run from server/ml with `python -m web.run`."""
from contextlib import asynccontextmanager
import hmac
import logging
import os
import threading
import uuid
import json
from fastapi import Depends, FastAPI, HTTPException, Request, Security
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from .engine import Engine
from .schemas import (DiagnoseRequest, Diagnosis, OriginalReport, ModelStatus, NarrativeRequest,
                      NarrativeResponse, CompareRequest, TutorRequest, TutorResponse, ClassNarrativeRequest)

log = logging.getLogger('edubridge.inference')
api_key = APIKeyHeader(name='X-Service-Key', auto_error=False, description='Server-to-server secret AI_SERVICE_KEY. Never put this key in frontend code.')
slots = threading.BoundedSemaphore(4)
slow_slots = threading.BoundedSemaphore(2)


def authorize(request: Request, supplied: str | None = Security(api_key)):
    expected = os.getenv('AI_SERVICE_KEY', '')
    if expected:
        if not supplied or not hmac.compare_digest(supplied.encode(), expected.encode()):
            raise HTTPException(401, 'Invalid service key.')
    elif os.getenv('NODE_ENV') == 'production' or request.client.host not in ('127.0.0.1', '::1', 'testclient'):
        raise HTTPException(503, 'Service authentication is not configured.')


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv('NODE_ENV') == 'production' and len(os.getenv('AI_SERVICE_KEY', '')) < 32:
        raise RuntimeError('Production requires an AI_SERVICE_KEY of at least 32 characters.')
    app.state.engine = Engine()
    yield
    # Google SDK clients are created lazily; close them when present.
    for transport in [app.state.engine.tutor_transport, app.state.engine.narrative._transport]:
        client = getattr(transport, '_client', None)
        if client is not None:
            client.close()


app = FastAPI(title='EduBridge CDA · CDM · P-DINA API', version='1.0.0', lifespan=lifespan,
              root_path=os.getenv('AI_ROOT_PATH', ''),
              description='Inferensi checkpoint beku, pemetaan learning gap, perbandingan pre/post, dan narasi Gemini. '
                          'Parameter tidak dilatih ulang saat request. Kalibrasi sintetis dibedakan dari validasi lapangan.',
              docs_url='/docs' if os.getenv('AI_DOCS_ENABLED', 'true').lower() == 'true' else None,
              redoc_url='/redoc' if os.getenv('AI_DOCS_ENABLED', 'true').lower() == 'true' else None)


@app.middleware('http')
async def boundaries(request: Request, call_next):
    request_id = str(uuid.uuid4())
    try:
        length = int(request.headers.get('content-length', '0'))
    except ValueError:
        return JSONResponse({'detail': 'Invalid Content-Length.'}, status_code=400)
    if length > 512_000:
        return JSONResponse({'detail': 'Request body too large.'}, status_code=413)
    if request.method == 'POST':
        if not request.headers.get('content-type', '').startswith('application/json'):
            return JSONResponse({'detail': 'Use application/json.'}, status_code=415)
        size = 0
        chunks = []
        async for chunk in request.stream():
            size += len(chunk)
            if size > 512_000:
                return JSONResponse({'detail': 'Request body too large.'}, status_code=413)
            chunks.append(chunk)
        request._body = b''.join(chunks)
        try:
            def invalid_constant(value):
                raise ValueError('Non-finite JSON number')
            json.loads(request._body, parse_constant=invalid_constant)
        except (ValueError, UnicodeDecodeError):
            return JSONResponse({'detail': 'Invalid JSON body.'}, status_code=400)
    response = await call_next(request)
    response.headers['X-Request-ID'] = request_id
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(Exception)
async def internal_error(request: Request, exc: Exception):
    log.error('Inference request failed: %s', type(exc).__name__)
    return JSONResponse({'detail': 'Inference unavailable. Check server logs.'}, status_code=500)


def guarded(fn, pool=slots):
    if not pool.acquire(timeout=2):
        raise HTTPException(503, 'Inference capacity reached. Retry shortly.', headers={'Retry-After': '2'})
    try:
        return fn()
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    finally:
        pool.release()


@app.get('/health', tags=['Health'])
def health():
    return {'status': 'ok'}


@app.get('/ready', tags=['Health'])
def ready(request: Request):
    return {'status': 'ready' if hasattr(request.app.state, 'engine') else 'starting'}


@app.get('/v1/models', response_model=list[ModelStatus], tags=['Models'], dependencies=[Depends(authorize)])
def models(request: Request):
    return request.app.state.engine.metadata()


@app.post('/v1/diagnose', response_model=Diagnosis | OriginalReport, tags=['CDA / CDM'], dependencies=[Depends(authorize)],
          responses={422: {'description': 'Unknown items, invalid responses, or mismatched instrument.'}, 503: {'description': 'Inference temporarily unavailable.'}})
def diagnose(body: DiagnoseRequest, request: Request):
    return guarded(lambda: request.app.state.engine.run(body)[0])


@app.post('/v1/compare', response_model=dict, tags=['CDA / CDM'], dependencies=[Depends(authorize)])
def compare(body: CompareRequest, request: Request):
    def compute():
        if body.pre.model_id != 'edubridge':
            raise ValueError('Use EduBridge matched topic instruments for this endpoint. Original pre/post analysis remains available in cdacdm.prepost.')
        pre = request.app.state.engine.run(body.pre)[0]
        post = request.app.state.engine.run(body.post)[0]
        return {'scoreChange': post['score']-pre['score'],
                'gapsClosed': sum(a['status']=='gap' and b['status']=='mastered' for a,b in zip(pre['attributes'],post['attributes'])),
                'newGaps': sum(a['status']=='mastered' and b['status']=='gap' for a,b in zip(pre['attributes'],post['attributes'])),
                'attributes': [{'id': a['id'], 'name': a['name'], 'pre': a['mastery'], 'post': b['mastery'], 'preLabel': a['label'], 'postLabel': b['label']} for a,b in zip(pre['attributes'],post['attributes'])],
                'note': 'Perubahan estimasi pada instrumen paralel; tidak membuktikan efek kausal pembelajaran.'}
    return guarded(compute)


@app.post('/v1/narrative', response_model=NarrativeResponse, tags=['Gemini'], dependencies=[Depends(authorize)])
def narrative(body: NarrativeRequest, request: Request):
    def compute():
        engine = request.app.state.engine
        _, result = engine.run(body)
        service = engine.services[body.model_id]
        return service.generate_narrative(result, body.audience, body.student_id if body.audience == 'student' else None, engine.narrative)
    return guarded(compute, slow_slots)


@app.post('/v1/tutor', response_model=TutorResponse, tags=['Gemini'], dependencies=[Depends(authorize)])
def tutor(body: TutorRequest, request: Request):
    return guarded(lambda: request.app.state.engine.tutor(body), slow_slots)


@app.post('/v1/class-narrative', response_model=NarrativeResponse, tags=['Gemini'], dependencies=[Depends(authorize)])
def class_narrative(body: ClassNarrativeRequest, request: Request):
    def compute():
        import pandas as pd
        from cdacdm.diagnosis import class_summary, student_summary, detect_learning_gaps
        from cdacdm.intervention import recommend_intervention
        engine = request.app.state.engine
        results = [engine.run(DiagnoseRequest(topic_id=body.topic_id, expected_model_version=body.expected_model_version, **student.model_dump()))[1] for student in body.students]
        service = engine.services['edubridge']
        profiles = pd.concat([r['profiles'] for r in results], ignore_index=True)
        gaps = detect_learning_gaps(profiles, service.policy)
        summary = class_summary(profiles)
        result = {'profiles': profiles, 'gaps': gaps, 'class_summary': summary, 'student_summary': student_summary(profiles),
                  'recommendations': recommend_intervention(gaps, service.intervention_map, service.target_map, summary, service.items),
                  'policy': service.policy.to_dict(), 'info': {'n_students': len(body.students), 'n_observed': sum(r['info']['n_observed'] for r in results)}}
        return service.generate_narrative(result, 'teacher', generator=engine.narrative)
    return guarded(compute, slow_slots)
