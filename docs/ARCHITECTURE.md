# System Architecture

## Frontend Prototype Modules

- Content engine
- Question engine
- Answer/analysis engine
- Vocabulary card engine
- Notebook engine
- Evaluation engine
- Persistence engine

## Data Model

profile:
- student information
- course metadata

answers:
- question id
- selected option
- correctness
- timestamp

notebook:
- saved words
- source sentence
- word category

grading:
- scores
- error types

 talent:
- learning evaluation
- growth report

ui:
- preferences
- expanded panels

## Future Backend

Suggested stack:

Frontend:
- React/Vue
- TypeScript

Backend:
- Node/Nest or Python FastAPI

Database:
- PostgreSQL

Storage:
- Object storage for course assets

Authentication:
- student / teacher accounts
