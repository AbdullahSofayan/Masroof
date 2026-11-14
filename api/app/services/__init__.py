"""Business logic. Routes stay thin and delegate everything here.

Conventions:
  * One class per file, constructed with the request's DB session: `UserService(db)`.
  * Services own commit/rollback. Routes never touch the session directly.
  * Services raise the errors in `app.core.exceptions`; routes don't catch them.
  * Services never import from `app.routes`.
"""
