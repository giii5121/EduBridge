from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class ResponseItem(StrictModel):
    question_id: str = Field(min_length=1, max_length=80, description='App item ID for edubridge; numeric QuestionId as a string for eedi/calculus.')
    answer_option: Annotated[int, Field(strict=True, ge=0, le=3)] | None = Field(default=None, description='Zero-based selected option, only for the EduBridge instrument. null means missing, never incorrect.')
    response: Literal[0, 1] | None = Field(default=None, description='Scored response for original EEDI/calculus instruments: 1 correct, 0 incorrect, null missing.')
    content_hash: str | None = Field(default=None, pattern=r'^[a-f0-9]{64}$', description='SHA-256 of the frozen item snapshot; changed items are excluded from calibrated evidence.')


class StudentResponses(StrictModel):
    student_id: str = Field(default='anonymous', min_length=1, max_length=80, description='Pseudonymous ID; do not send student names or email addresses.')
    responses: list[ResponseItem] = Field(min_length=1, max_length=250)


class DiagnoseRequest(StudentResponses):
    model_id: Literal['edubridge', 'eedi', 'calculus'] = 'edubridge'
    topic_id: str | None = Field(default=None, max_length=80)
    expected_model_version: str | None = Field(default=None, max_length=100, description='Optional immutable model fingerprint; mismatches are rejected rather than reinterpreting a historical diagnosis.')

    @model_validator(mode='after')
    def valid_layout(self):
        ids = [r.question_id for r in self.responses]
        if len(ids) != len(set(ids)):
            raise ValueError('Duplicate question_id values are not allowed.')
        if self.model_id == 'edubridge':
            if not self.topic_id:
                raise ValueError('topic_id is required for EduBridge.')
            if any(r.response is not None for r in self.responses):
                raise ValueError('Use answer_option for EduBridge; scoring is performed by the server.')
        elif any(r.answer_option is not None for r in self.responses):
            raise ValueError('Use response for EEDI/calculus; no complete MCQ option bank is available.')
        return self


class Attribute(StrictModel):
    id: int
    conceptId: int
    name: str
    mastery: float | None
    probability: float | None
    evidence: int
    correct: int
    status: Literal['mastered', 'developing', 'gap', 'unknown']
    label: Literal['mastered', 'not_mastered', 'uncertain', 'insufficient_evidence']
    posteriorSd: float


class Recommendation(StrictModel):
    attributeId: int
    title: str
    reason: str
    blockIndex: int
    action: str


class Diagnosis(StrictModel):
    provider: str = 'pdina'
    simulated: bool = False
    calibrationSynthetic: bool
    version: str
    instrumentVersion: str
    score: int
    correctCount: int
    total: int
    observedCount: int
    attributes: list[Attribute]
    gapCount: int
    uncertainCount: int
    insufficientCount: int
    recommendations: list[Recommendation]
    policy: dict
    unsupportedItemIds: list[str]
    limitations: list[str]


class NarrativeRequest(DiagnoseRequest):
    audience: Literal['student', 'teacher'] = 'student'


class NarrativeResponse(StrictModel):
    text: str
    meta: dict
    validation: dict
    fallback: bool


class CompareRequest(StrictModel):
    pre: DiagnoseRequest
    post: DiagnoseRequest

    @model_validator(mode='after')
    def matched(self):
        if (self.pre.student_id, self.pre.topic_id, self.pre.model_id) != (self.post.student_id, self.post.topic_id, self.post.model_id):
            raise ValueError('Pre/post must refer to the same student, topic and model.')
        return self


class TutorMessage(StrictModel):
    role: Literal['user', 'assistant']
    text: str = Field(min_length=1, max_length=2000)


class LessonBlock(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=5000)
    example: str = Field(min_length=1, max_length=3000)


class LessonContext(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    blocks: list[LessonBlock] = Field(min_length=3, max_length=3)


class TutorRequest(StrictModel):
    topic_id: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=1000)
    history: list[TutorMessage] = Field(default_factory=list, max_length=6)
    lesson: LessonContext | None = Field(default=None, description='Optional current curated lesson from the application backend, excluding assessment questions, answer keys, and account identities.')


class TutorResponse(StrictModel):
    message: str
    provider: str
    fallback: bool
    simulated: bool = False
    blockIndex: int
    reason: str | None = None


class ClassNarrativeRequest(StrictModel):
    topic_id: str = Field(min_length=1, max_length=80)
    students: list[StudentResponses] = Field(min_length=1, max_length=60)
    expected_model_version: str | None = Field(default=None, max_length=100)

    @model_validator(mode='after')
    def unique_students(self):
        ids = [s.student_id for s in self.students]
        if len(ids) != len(set(ids)):
            raise ValueError('Duplicate student_id values are not allowed.')
        return self


class ModelStatus(StrictModel):
    id: str
    provider: str
    version: str
    concepts: int
    items: int
    calibrationSynthetic: bool
    policy: dict
    limitations: list[str]


class OriginalReport(StrictModel):
    generated_by: str
    model: str | None
    artifact_source: str | None
    policy: dict
    input_info: dict
    mastery_profiles_target: list[dict]
    learning_gaps: list[dict]
    intervention_recommendations: list[dict]
    class_summary: list[dict]
    pre_post: dict | None
    disclaimer: str
