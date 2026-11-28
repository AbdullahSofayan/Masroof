"""Load the ML demo seed files by hand, from any folder.

The API already loads api/seed_data/ when it starts (app/services/seed.py).
Use this to load from another folder, or with another password:

    python -m app.seed_demo
    python -m app.seed_demo "C:\\Users\\you\\Downloads\\seed\\seed"
    python -m app.seed_demo <folder> --password "Another123!"
"""
import argparse
from pathlib import Path

from app.db.session import Base, SessionLocal, engine
from app.services.seed import DEMO_FOLDER, DEMO_PASSWORD, seed_categories, seed_demo_data


def main() -> None:
    parser = argparse.ArgumentParser(description="Load the ML demo seed files into MySQL.")
    parser.add_argument("folder", nargs="?", default=str(DEMO_FOLDER), help="Folder with the 6 seed CSV files.")
    parser.add_argument("--password", default=DEMO_PASSWORD, help="Demo password for every seeded user.")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_categories(db)
        seed_demo_data(db, Path(args.folder), args.password)


if __name__ == "__main__":
    main()