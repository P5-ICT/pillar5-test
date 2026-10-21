from pydantic import BaseModel, Field, field_validator


class StartIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    surname: str = Field(min_length=1, max_length=60)

    @field_validator("first_name", "surname")
    @classmethod
    def clean(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("This field cannot be empty.")
        return value


class AnswerIn(BaseModel):
    question_id: int
    choice: int = Field(ge=0, le=9)


class AdminLoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class MarkIn(BaseModel):
    b_mark: int = Field(ge=0, le=30)
