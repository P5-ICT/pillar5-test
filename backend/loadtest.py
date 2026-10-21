"""Simulate many students taking the test at the same moment.

Usage (server already running):
    python loadtest.py --base http://127.0.0.1:8000 --students 50

Every simulated student starts the test, reads it, answers all questions with short pauses,
attaches a file, submits, and checks that the score the server reports is correct.
"""
import argparse
import asyncio
import random
import statistics
import time

import httpx

from app.config import ANSWER_KEY  # the key is only used here to check the server's marking


async def student(n: int, client: httpx.AsyncClient, think: float, timings: list, errors: list):
    async def call(method, url, **kw):
        t0 = time.perf_counter()
        try:
            r = await client.request(method, url, **kw)
            timings.append(time.perf_counter() - t0)
            if r.status_code >= 400:
                errors.append(f"student {n}: {method} {url} -> {r.status_code} {r.text[:80]}")
            return r
        except Exception as exc:  # network error or timeout
            errors.append(f"student {n}: {method} {url} -> {type(exc).__name__}")
            return None

    r = await call("POST", "/api/attempts", json={"first_name": f"Student{n}", "surname": "Load"})
    if r is None or r.status_code != 201:
        return None
    headers = {"Authorization": f"Bearer {r.json()['token']}"}

    await call("GET", "/api/attempt", headers=headers)
    expected = 0
    for question_id in sorted(ANSWER_KEY):
        await asyncio.sleep(random.uniform(0, think))
        right = random.random() < 0.7
        choice = ANSWER_KEY[question_id] if right else (ANSWER_KEY[question_id] + 1) % 4
        expected += 1 if right else 0
        await call("PUT", "/api/attempt/answers", json={"question_id": question_id, "choice": choice}, headers=headers)
        if random.random() < 0.15:  # a student refreshes the page now and then
            await call("GET", "/api/attempt", headers=headers)

    await call("POST", "/api/attempt/files", files={"file": ("app.py", b"print('help desk')\n" * 200)}, headers=headers)
    await call("POST", "/api/attempt/files", files={"file": ("index.html", b"<h1>Help Desk</h1>\n" * 100)}, headers=headers)
    r = await call("POST", "/api/attempt/submit", headers=headers)
    if r is not None and r.status_code == 200:
        got = r.json()["result"]["score"]
        if got != expected:
            errors.append(f"student {n}: wrong score, expected {expected} got {got}")
        return got
    return None


async def main(base: str, students: int, think: float):
    timings: list[float] = []
    errors: list[str] = []
    limits = httpx.Limits(max_connections=students * 2)
    async with httpx.AsyncClient(base_url=base, timeout=30, limits=limits) as client:
        started = time.perf_counter()
        results = await asyncio.gather(*[student(i, client, think, timings, errors) for i in range(students)])
        elapsed = time.perf_counter() - started

    finished = sum(r is not None for r in results)
    timings.sort()
    pct = lambda p: timings[min(len(timings) - 1, int(len(timings) * p))] * 1000
    print(f"students started together : {students}")
    print(f"students who finished     : {finished}")
    print(f"requests sent             : {len(timings)}")
    print(f"total time                : {elapsed:.1f} s")
    print(f"response time median      : {statistics.median(timings) * 1000:.0f} ms")
    print(f"response time 95th pct    : {pct(0.95):.0f} ms")
    print(f"response time slowest     : {timings[-1] * 1000:.0f} ms")
    print(f"errors                    : {len(errors)}")
    for line in errors[:10]:
        print("  ", line)
    raise SystemExit(0 if finished == students and not errors else 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    parser.add_argument("--students", type=int, default=50)
    parser.add_argument("--think", type=float, default=0.4, help="max pause between answers, in seconds")
    args = parser.parse_args()
    asyncio.run(main(args.base, args.students, args.think))
