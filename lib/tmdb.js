import axios from "axios";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function getAuthConfig() {
 
  const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY;

  
  const readToken = process.env.EXPO_PUBLIC_TMDB_READ_TOKEN;

  if (readToken) return { kind: "bearer", value: readToken };
  if (apiKey) return { kind: "apiKey", value: apiKey };
  return { kind: "missing", value: "" };
}

const client = axios.create({
  baseURL: TMDB_BASE_URL,
  timeout: 15000,
});

export async function tmdbGet(path, params = {}) {
  const auth = getAuthConfig();
  if (auth.kind === "missing") {
    throw new Error("Missing TMDB credentials. Set EXPO_PUBLIC_TMDB_API_KEY (preferred) or EXPO_PUBLIC_TMDB_READ_TOKEN.");
  }
  const res = await client.get(path, {
    headers: auth.kind === "bearer" ? { Authorization: `Bearer ${auth.value}` } : undefined,
    params: {
      language: "en-US",
      ...params,
      ...(auth.kind === "apiKey" ? { api_key: auth.value } : {}),
    },
  });
  return res.data;
}

export function getPosterUrl(posterPath) {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/w185${posterPath}`;
}

export async function fetchMovies(subType, page = 1) {
  return tmdbGet(`/movie/${subType}`, { page });
}

export async function fetchTv(subType, page = 1) {
  return tmdbGet(`/tv/${subType}`, { page });
}

export async function fetchSearch(searchType, query, page = 1) {
  return tmdbGet(`/search/${searchType}`, { query, page, include_adult: false });
}

export async function fetchMovieById(movieId) {
  return tmdbGet(`/movie/${movieId}`);
}

export async function fetchMovieReleaseDates(movieId) {
  return tmdbGet(`/movie/${movieId}/release_dates`);
}

export async function fetchTvById(tvId) {
  return tmdbGet(`/tv/${tvId}`);
}


