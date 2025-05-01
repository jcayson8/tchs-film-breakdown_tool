# TCHS Football Film Breakdown Tool (Starter Repo)

This starter repository packages a minimal Node/Express backend and a React frontend into a single Docker container for quick deployment to Render.

## Quick start (local)
```bash
git clone <this_repo_url>
cd tchs_film_breakdown_repo
docker build -t tchs-film .
docker run -p 8080:8080 tchs-film
# Visit http://localhost:8080
```

## Deploy to Render
1. Create a new **Web Service** at https://dashboard.render.com
2. Point it at this GitHub repo.
3. Choose **Docker** environment.
4. Hit **Create Web Service** – Render will build and host.
5. Optionally add a Postgres instance and environment variables for S3.
