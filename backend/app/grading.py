"""Marking for Section A. The answer key lives only on the server."""
from .config import ANSWER_KEY


def grade(answers: dict[int, int]) -> tuple[int, list[dict]]:
    """Return the score and a per-question breakdown. The right answer is never included."""
    per = []
    score = 0
    for question_id in sorted(ANSWER_KEY):
        chosen = answers.get(question_id)
        correct = chosen is not None and chosen == ANSWER_KEY[question_id]
        score += 1 if correct else 0
        per.append({"n": question_id, "chosen": chosen, "correct": correct})
    return score, per
