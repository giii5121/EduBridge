"""Reproducible instrument-specific calibration. SYNTHETIC data, never a claim of field validity.

Required because neither EEDI nor calculus checkpoints contain EduBridge's 18 attributes/180 items.
Does not retrain or replace either supplied checkpoint. Run explicitly, never on service startup.
"""
from pathlib import Path
import hashlib
import json
import sys
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from sklearn.metrics import log_loss, roc_auc_score, brier_score_loss

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from cdacdm.models import PDINA, sigmoid


def main():
    raw = (ROOT / 'instruments/edubridge.json').read_bytes()
    instrument = json.loads(raw)
    out = ROOT / 'artifacts_edubridge'
    model_dir = out / 'model'
    model_dir.mkdir(parents=True, exist_ok=True)
    dataset = ROOT / 'datasets/edubridge'
    dataset.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(20261117)
    topics = instrument['topics']
    items = [q for t in topics for q in t['items']]
    concepts = [dict(concept_id=cid, concept_name=name, topic_id=t['id'], concept_index=ti*3+ai, in_target_scope=True)
                for ti, t in enumerate(topics) for ai, (cid, name) in enumerate(zip(t['conceptIds'], t['attributes']))]
    cids = np.array([c['concept_id'] for c in concepts])
    qids = np.array([q['questionId'] for q in items])
    Q = np.zeros((len(items), len(concepts)))
    for ti, t in enumerate(topics):
        for qi, q in enumerate(t['items']):
            Q[ti * 30 + qi, [ti * 3 + ai for ai in q['attributes']]] = 1
    N, J, K = 2000, len(items), len(concepts)
    theta = rng.normal(size=(N, 1))
    prior = sigmoid(1.15 * theta - np.linspace(-0.5, 0.5, K))
    mastery = rng.random((N, K)) < prior
    guess, slip = rng.uniform(0.17, 0.28, J), rng.uniform(0.07, 0.20, J)
    eta = (mastery.astype(int) @ Q.T) == Q.sum(1)
    X = (rng.random((N, J)) < np.where(eta, 1-slip, guess)).astype(float)
    M = rng.random((N, J)) < 0.52
    splits = {'train': np.arange(1600), 'val': np.arange(1600, 1800), 'test': np.arange(1800, 2000)}
    for name, ix in splits.items():
        np.savez_compressed(dataset / f'responses_{name}.npz', X=X[ix], M=M[ix], student_ids=ix, question_ids=qids, mastery=mastery[ix])
        s, j = np.where(M[ix])
        pd.DataFrame({'student_id': [f'SYN-{ix[v]:04d}' for v in s], 'QuestionId': qids[j], 'response': X[ix][s, j].astype(int)}).to_csv(dataset / f'interactions_{name}.csv', index=False)
    def heldout(ix):
        observed = M[ix].copy()
        held = observed & (rng.random(observed.shape) < 0.2)
        return observed & ~held, held
    vm, vh = heldout(splits['val'])
    candidates = []
    for prior_name in ['independent', 'higher_order']:
        for strength in [2, 10]:
            model = PDINA(Q, prior=prior_name, gs_prior_strength=strength, max_em_iter=150)
            model.question_ids, model.concept_ids = qids, cids
            model.fit(X[:1600], M[:1600])
            prediction = model.predict_proba(model.infer(X[1600:1800], vm))
            loss = log_loss(X[1600:1800][vh], prediction[vh])
            candidates.append((loss, model, {'prior': prior_name, 'strength': strength, 'validation_log_loss': loss}))
            print(json.dumps(candidates[-1][2]), flush=True)
    _, model, selected = min(candidates, key=lambda c: c[0])
    # Select tau on validation truth ONLY. The generating truth is available only for this synthetic study.
    val_post = model.infer(X[1600:1800], M[1600:1800])
    eligible = val_post.n_evidence >= 5
    thresholds = []
    for tau in np.arange(0.35, 0.71, 0.05):
        accuracy = float(((val_post.pi >= tau) == mastery[1600:1800])[eligible].mean())
        thresholds.append({'tau': round(float(tau), 2), 'synthetic_attribute_accuracy': accuracy})
    tau = max(thresholds, key=lambda row: (row['synthetic_attribute_accuracy'], -abs(row['tau']-0.5)))['tau']
    policy = dict(tau=tau, delta=0.05, n_min=5, target_concept_ids=cids.tolist(), provenance={
        'source': 'synthetic_validation_only', 'tau': 'validation synthetic mastery accuracy; ties favor 0.5',
        'n_min': 'conservative five observed answers per attribute; not field-validated', 'delta': 'conservative uncertainty band; not empirically field-validated'})
    tm, th = heldout(splits['test'])
    pred = model.predict_proba(model.infer(X[1800:], tm))
    test_post = model.infer(X[1800:], M[1800:])
    te = test_post.n_evidence >= 5
    metrics = dict(log_loss=float(log_loss(X[1800:][th], pred[th])), roc_auc=float(roc_auc_score(X[1800:][th], pred[th])),
                   brier=float(brier_score_loss(X[1800:][th], pred[th])), synthetic_mastery_accuracy=float(((test_post.pi >= tau) == mastery[1800:])[te].mean()),
                   heldout_responses=int(th.sum()), students=200)
    model.save(model_dir, {'instrument_version': instrument['version'], 'instrument_sha256': hashlib.sha256(raw).hexdigest()})
    (model_dir / 'diagnosis_policy.json').write_text(json.dumps(policy, indent=2), encoding='utf-8')
    pd.DataFrame(concepts).to_csv(model_dir / 'concept_metadata.csv', index=False)
    target = pd.DataFrame(concepts).assign(curriculum_order=np.arange(1, K+1), prerequisite_concept_ids='', review_status='draft_teacher_review')
    target.to_csv(model_dir / 'target_concept_map.csv', index=False)
    bank = pd.DataFrame([{'QuestionId': q['questionId'], 'app_id': q['id'], 'question_text': q['text'], 'correct_answer': q['answer']+1,
                          'content_hash': q['contentHash'], 'concept_ids': ';'.join(str(cids[int(k)]) for k in np.where(Q[j])[0])} for j, q in enumerate(items)])
    bank.to_csv(model_dir / 'item_bank.csv', index=False)
    params = bank[['QuestionId', 'app_id', 'concept_ids']].copy()
    params['guess'], params['slip'] = model.g, model.s
    params['discrimination'] = model.discrimination
    params['model_difficulty'] = 1 - (model.g + 1-model.s)/2
    params['reliable_params'] = M[:1600].sum(0) >= 30
    params['any_concept_target'] = True
    params['n_train'] = M[:1600].sum(0)
    params.to_csv(model_dir / 'item_parameters.csv', index=False)
    pd.DataFrame(Q.astype(int), index=qids, columns=cids).rename_axis('QuestionId').to_csv(model_dir / 'q_matrix.csv')
    interventions = []
    for t in topics:
        for ai, cid in enumerate(t['conceptIds']):
            interventions.append(dict(concept_id=cid, concept_name=t['attributes'][ai], gap_description=f"Penguatan {t['attributes'][ai]}",
                                     material_source=f"/materi/{t['id']}?bagian={ai}", remedial_activity=t['blocks'][ai]['body'],
                                     enrichment_practice='Latihan penguatan atribut di EduBridge', estimated_duration_min=10,
                                     status='draft_teacher_review', validated_by='', notes='Materi tersedia; kesesuaian pedagogis memerlukan tinjauan guru.'))
    pd.DataFrame(interventions).to_csv(model_dir / 'intervention_map_resolved.csv', index=False)
    card = dict(version=instrument['version'], generated_at=datetime.now(timezone.utc).isoformat(),
                data={'artifact_source': 'edubridge_indonesian_synthetic', 'students': N, 'items': J, 'concepts': K, 'observed_responses': int(M.sum()), 'splits': {k: len(v) for k,v in splits.items()},
                      'note': 'SYNTHETIC, not actual Indonesian student responses. No empirical classroom validation claimed.'},
                rationale='Supplied EEDI and calculus checkpoints have incompatible item IDs and attributes. Original checkpoints preserved unchanged.',
                model_selection={'main_model': 'P-DINA', 'selected': selected, 'candidates': [c[2] for c in candidates]},
                diagnosis_policy=policy, validation_thresholds=thresholds, test_evaluation=metrics,
                limitations=['Synthetic calibration only; validate Q-matrix/content with teachers and collect real pre/post responses.',
                             'Posterior estimates are not verified mastery. Pre/post changes do not establish causal treatment effects.',
                             'Editing item text, answer key, options, or attributes invalidates calibration for that item.'])
    (model_dir / 'model_card.json').write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding='utf-8')
    (dataset / 'dataset_manifest.json').write_text(json.dumps(card['data'] | {'seed': 20261117}, indent=2), encoding='utf-8')
    (out / 'evaluation.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')
    print(json.dumps({'selected': selected, 'test': metrics}), flush=True)

if __name__ == '__main__':
    main()
