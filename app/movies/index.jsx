import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Keyboard, Pressable, Text, View } from "react-native";

import AppSelect from "../../components/UI/AppSelect";
import AppButton from "../../components/UI/AppButton";
import AppInput from "../../components/UI/AppInput";
import { fetchMovies, fetchSearch, fetchTv, getPosterUrl } from "../../lib/tmdb";

const TAB_KEYS = {
  movies: "movies",
  search: "search",
  tv: "tv",
};

const MOVIE_OPTIONS = [
  { label: "Now Playing", value: "now_playing" },
  { label: "Popular", value: "popular" },
  { label: "Top Rated", value: "top_rated" },
  { label: "Upcoming", value: "upcoming" },
];

const TV_OPTIONS = [
  { label: "Airing Today", value: "airing_today" },
  { label: "On The Air", value: "on_the_air" },
  { label: "Popular", value: "popular" },
  { label: "Top Rated", value: "top_rated" },
];

const SEARCH_OPTIONS = [
  { label: "Multi", value: "multi" },
  { label: "Movie", value: "movie" },
  { label: "TV", value: "tv" },
];

function getTitle(item) {
  return item?.title || item?.name || item?.original_title || item?.original_name || "Untitled";
}

function getDate(item) {
  return item?.release_date || item?.first_air_date || "";
}

function getMediaTypeFromItem(activeTab, searchType, item) {
  if (activeTab === TAB_KEYS.movies) return "movie";
  if (activeTab === TAB_KEYS.tv) return "tv";
  if (searchType !== "multi") return searchType;
  return item?.media_type || "movie";
}

function TopTabs({ activeTab, onChange }) {
  const tabs = [
    { key: TAB_KEYS.movies, label: "Movies" },
    { key: TAB_KEYS.search, label: "Search Results" },
    { key: TAB_KEYS.tv, label: "TV Shows" },
  ];

  return (
    <View className="flex-row bg-gray-100 border-b border-gray-200">
      {tabs.map((t) => {
        const isActive = t.key === activeTab;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            className="flex-1 py-3 items-center"
            style={{
              borderBottomWidth: isActive ? 2 : 0,
              borderBottomColor: isActive ? "#1f2937" : "transparent",
            }}
          >
            <Text style={{ color: isActive ? "#1f2937" : "#9ca3af", fontWeight: isActive ? "600" : "500" }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ResultRow({ item, onPressDetails }) {
  const poster = getPosterUrl(item?.poster_path);
  const title = getTitle(item);
  const popularity = typeof item?.popularity === "number" ? item.popularity.toFixed(3) : "—";
  const date = getDate(item);

  return (
    <View className="flex-row bg-white border border-gray-200 rounded-lg overflow-hidden mb-3">
      {poster ? (
        <Image source={{ uri: poster }} style={{ width: 92, height: 132 }} />
      ) : (
        <View style={{ width: 92, height: 132 }} className="bg-gray-200 items-center justify-center">
          <Text className="text-gray-500 text-xs">No Image</Text>
        </View>
      )}
      <View className="flex-1 p-3">
        <Text className="text-base font-semibold text-gray-900 mb-1" numberOfLines={2}>
          {title}
        </Text>
        <Text className="text-gray-600">Popularity: {popularity}</Text>
        <Text className="text-gray-600">Release Date: {date}</Text>

        <View className="mt-2">
          <AppButton
            className="bg-cyan-500 border-cyan-500 py-3"
            onPress={onPressDetails}
          >
            <Text style={{ color: "#ffffff", fontWeight: "700" }}>More Details</Text>
          </AppButton>
        </View>
      </View>
    </View>
  );
}

export default function MoviesAppScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(TAB_KEYS.movies);
  const [movieType, setMovieType] = useState("now_playing");
  const [tvType, setTvType] = useState("popular");

  const [searchType, setSearchType] = useState("multi");
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [searchPageLoading, setSearchPageLoading] = useState(false);
  const searchRequestIdRef = useRef(0);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [pageChanging] = useState(false);

 
  const perPage = 10;
  const [pageIndex, setPageIndex] = useState(1);

  const filteredResults = useMemo(() => {
    return results;
  }, [activeTab, results, searchType]);

  const totalPages = Math.max(1, Math.ceil(totalResults / perPage));
  const pageResults = filteredResults;

  function resetPaging() {
    setPageIndex(1);
  }

  function goToPage(nextPage) {
    const isMultiSearch = activeTab === TAB_KEYS.search && searchType === "multi";
    if (activeTab === TAB_KEYS.search && searchPageLoading) {
      return;
    }
    if (isMultiSearch) {
      const store = multiStoreRef.current;
      const maxLoadedPages = Math.max(1, Math.ceil(store.items.length / perPage));
      const hasMore = store.nextPage <= store.totalPages;
      if (nextPage > maxLoadedPages && !hasMore) {
        return;
      }
    }
    if (activeTab === TAB_KEYS.search) {
      setSearchCompleted(false);
      setSearchPageLoading(true);
    }
    setPageIndex(nextPage);
  }

  const multiStoreRef = useRef({
    query: "",
    items: [],
    nextPage: 1,
    totalPages: 1,
  });

  async function loadMovies(localPage = pageIndex) {
    setLoading(true);
    setApiError("");
    try {
      const tmdbPage = Math.max(1, Math.ceil(localPage / 2));
      const data = await fetchMovies(movieType, tmdbPage);
      const all = Array.isArray(data?.results) ? data.results : [];
      const sliceStart = localPage % 2 === 1 ? 0 : perPage;
      setResults(all.slice(sliceStart, sliceStart + perPage));
      setTotalResults(Number(data?.total_results || 0));
    } catch (e) {
      setApiError("Failed to load movies. Check your TMDB API key.");
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }

  async function loadTv(localPage = pageIndex) {
    setLoading(true);
    setApiError("");
    try {
      const tmdbPage = Math.max(1, Math.ceil(localPage / 2));
      const data = await fetchTv(tvType, tmdbPage);
      const all = Array.isArray(data?.results) ? data.results : [];
      const sliceStart = localPage % 2 === 1 ? 0 : perPage;
      setResults(all.slice(sliceStart, sliceStart + perPage));
      setTotalResults(Number(data?.total_results || 0));
    } catch (e) {
      setApiError("Failed to load TV shows. Check your TMDB API key.");
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }

  async function loadSearch(localPage = pageIndex) {
    const q = query.trim();
    if (!q) return;
    const searchRequestId = ++searchRequestIdRef.current;
    setLoading(true);
    setApiError("");
    setSearchCompleted(false);
    setSearchPageLoading(true);
    try {
      if (searchType === "multi") {
        const store = multiStoreRef.current;
        if (store.query !== q) {
          store.query = q;
          store.items = [];
          store.nextPage = 1;
          store.totalPages = 1;
          store.totalResults = 0;
        }

        const targetEnd = localPage * perPage;
        const fetchNextPage = async () => {
          if (store.nextPage > store.totalPages) return false;
          const data = await fetchSearch(searchType, q, store.nextPage);
          if (searchRequestId !== searchRequestIdRef.current) return false;
          store.totalPages = Math.max(1, Number(data?.total_pages || 1));
          store.totalResults = Number(data?.total_results || 0);
          const filtered = Array.isArray(data?.results)
            ? data.results.filter((r) => r.media_type === "movie" || r.media_type === "tv")
            : [];
          store.items = store.items.concat(filtered);
          store.nextPage += 1;
          return true;
        };

        if (store.items.length < targetEnd) {
          await fetchNextPage();
        }

        if (searchRequestId !== searchRequestIdRef.current) return;
        const start = (localPage - 1) * perPage;
        const pageSlice = store.items.slice(start, start + perPage);
        const hasMore = store.nextPage <= store.totalPages;
        const estimatedTotal = hasMore ? Math.max(store.items.length, localPage * perPage + 1) : store.items.length;
        setResults(pageSlice);
        setTotalResults(estimatedTotal);
        setLoading(false);
        if (!hasMore) {
          const maxPage = Math.max(1, Math.ceil(store.items.length / perPage));
          if (localPage > maxPage) {
            setPageIndex(maxPage);
          }
        }
        if (pageSlice.length > 0 || !hasMore) {
          setSearchCompleted(true);
          setSearchPageLoading(false);
        }

        if (store.items.length < targetEnd && store.nextPage <= store.totalPages) {
          (async () => {
            while (store.items.length < targetEnd && store.nextPage <= store.totalPages) {
              const ok = await fetchNextPage();
              if (!ok) return;
            }
            if (searchRequestId !== searchRequestIdRef.current) return;
            const updatedSlice = store.items.slice(start, start + perPage);
            const hasMoreLater = store.nextPage <= store.totalPages;
            const updatedTotal = hasMoreLater
              ? Math.max(store.items.length, localPage * perPage + 1)
              : store.items.length;
            setResults(updatedSlice);
            setTotalResults(updatedTotal);
            if (!hasMoreLater) {
              const maxPage = Math.max(1, Math.ceil(store.items.length / perPage));
              if (localPage > maxPage) {
                setPageIndex(maxPage);
              }
            }
            if (updatedSlice.length > 0 || !hasMoreLater) {
              setSearchCompleted(true);
              setSearchPageLoading(false);
            }
          })();
        }
        return;
      }
      const tmdbPage = Math.max(1, Math.ceil(localPage / 2));
      const data = await fetchSearch(searchType, q, tmdbPage);
      if (searchRequestId !== searchRequestIdRef.current) return;
      const all = Array.isArray(data?.results) ? data.results : [];
      const sliceStart = localPage % 2 === 1 ? 0 : perPage;
      setResults(all.slice(sliceStart, sliceStart + perPage));
      setTotalResults(Number(data?.total_results || 0));
    } catch (e) {
      if (searchRequestId !== searchRequestIdRef.current) return;
      setApiError("Failed to search. Check your TMDB API key.");
      setResults([]);
      setTotalResults(0);
    } finally {
      if (searchRequestId !== searchRequestIdRef.current) return;
      setLoading(false);
      setSearchCompleted(true);
      setSearchPageLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === TAB_KEYS.movies) loadMovies();
    if (activeTab === TAB_KEYS.tv) loadTv();
    if (activeTab === TAB_KEYS.search) {
      
      if (hasSearched && query.trim()) loadSearch();
      else {
        setResults([]);
        setTotalResults(0);
        setSearchCompleted(false);
      }
    }
    
  }, [activeTab, movieType, tvType, pageIndex]);

  useEffect(() => {
    if (activeTab === TAB_KEYS.search && hasSearched && query.trim()) loadSearch();
    
  }, [searchType, pageIndex]);

  const showSearchPrompt = activeTab === TAB_KEYS.search && !hasSearched;
  const isSearchLoading =
    activeTab === TAB_KEYS.search && hasSearched && (loading || searchPageLoading || !searchCompleted);
  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-slate-700 pt-5 pb-5 items-center">
        <Text className="text-white text-xl font-semibold">Movies App</Text>
      </View>

      <TopTabs
        activeTab={activeTab}
        onChange={(k) => {
          setApiError("");
          setSearchError("");
          resetPaging();
          setActiveTab(k);
        }}
      />

      <View className="px-5 py-4">
        {activeTab === TAB_KEYS.movies && (
          <AppSelect
            label="Choose Movie Type "
            labelClassName="text-base font-semibold"
            value={movieType}
            options={MOVIE_OPTIONS}
              onChange={(v) => {
                resetPaging();
                setMovieType(v);
              }}
          />
        )}

        {activeTab === TAB_KEYS.tv && (
          <AppSelect
            label="Choose TV Show Type "
            labelClassName="text-base font-semibold"
            value={tvType}
            options={TV_OPTIONS}
              onChange={(v) => {
                resetPaging();
                setTvType(v);
              }}
          />
        )}

        {activeTab === TAB_KEYS.search && (
          <View>
            <View className="flex-row items-center mb-1">
              <Text className="text-base font-semibold text-gray-800">Search Movie/TV Show Name</Text>
              <Text className="text-red-500 ml-[2px] ">*</Text>
            </View>

            <View
              className="flex-row items-center px-4 py-3 rounded-lg"
              style={{
                backgroundColor: "#f3f4f6",
                borderWidth: 1,
                borderColor: searchError ? "#ef4444" : "#e5e7eb",
              }}
            >
              <View className="flex-1">
                <AppInput
                  value={query}
                  onChangeText={(t) => {
                    setQuery(t);
                    if (searchError) setSearchError("");
                  }}
                  placeholder="Enter name here..."
                  className="mb-0 border-0 bg-transparent px-0 py-0"
                />
              </View>
            </View>

            <View className="flex-row items-start gap-3 mt-3 mb-3">
              <View className="flex-1">
                <AppSelect
                  label="Choose Search Type "
                  labelClassName="text-base font-semibold"
                  value={searchType}
                  options={SEARCH_OPTIONS}
                  onChange={(v) => {
                    resetPaging();
                    setSearchType(v);
                  }}
                  hasError={!!searchError}
                  sheetHeightRatio={0.22}
                  showRequired
                />
              </View>
              <View style={{ width: 140 }}>
                <Text className="text-base font-semibold text-transparent mb-1">Spacer</Text>
                <AppButton
                  className="bg-cyan-500 border-cyan-500 px-4 py-3"
                  onPress={async () => {
                    Keyboard.dismiss();
                    const q = query.trim();
                    if (!q) {
                      setSearchError("required");
                      setHasSearched(false);
                      setResults([]);
                      setTotalResults(0);
                      return;
                    }
                    setSearchError("");
                    setSearchCompleted(false);
                    setHasSearched(true);
                    setSearchPageLoading(true);
                    goToPage(1);
                    await loadSearch(1);
                  }}
                >
                  <View className="flex-row items-center justify-center gap-2 h-[17px] px-4 py-0">
                    <FontAwesome name="search" size={17} color="#ffffff" />
                    <Text style={{ color: "#ffffff", fontWeight: "700" }}>Search</Text>
                  </View>
                </AppButton>
              </View>
            </View>

            {!!searchError && <Text className="text-red-500 mt-4">Movie/TV Show Name Is Required</Text>}
          </View>
        )}
      </View>

      {apiError ? (
        <View className="px-5">
          <Text className="text-red-600">{apiError}</Text>
        </View>
      ) : null}

      {showSearchPrompt ? (
        <View className="flex-1  justify-center px-8 ">
          <Text className="text-2xl font-semibold text-gray-800 text-center ">Please initiate a search.</Text>
        </View>
      ) : isSearchLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#06b6d4" />
        </View>
      ) : loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#06b6d4" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          data={pageResults}
          keyExtractor={(item, index) =>
            activeTab === TAB_KEYS.search && searchType === "multi"
              ? `${item.media_type}-${item.id}-${index}`
              : String(item.id)
          }
          renderItem={({ item }) => {
            const mediaType = getMediaTypeFromItem(activeTab, searchType, item);
            return (
              <ResultRow
                item={item}
                onPressDetails={() => {
                  router.push({
                    pathname: "/movies/details/[mediaType]/[id]",
                    params: { mediaType, id: String(item.id) },
                  });
                }}
              />
            );
          }}
          ListEmptyComponent={() =>
            isSearchLoading ? (
              <View className="px-5 py-[130px] items-center">
                <ActivityIndicator size="large" color="#06b6d4" />
              </View>
            ) : activeTab === TAB_KEYS.search && !hasSearched ? null : (
              <View className="px-5 py-[130px] items-center">
                <Text className="text-gray-500 text-2xl">No results found.</Text>
              </View>
            )
          }
        />
      )}

      {totalPages > 1 && totalResults > 0 && !showSearchPrompt ? (
        <View className="pb-4 pt-4 px-6 bg-gray-200">
          <View className="flex-row items-center justify-between">
            {pageIndex > 1 ? (
              <Pressable
                onPress={() => goToPage(pageIndex - 1)}
                className="px-4 py-3 rounded border border-gray-300 bg-white"
                style={{
                  opacity: pageChanging || loading || (activeTab === TAB_KEYS.search && searchPageLoading) ? 0.4 : 1,
                }}
                disabled={pageChanging || loading || (activeTab === TAB_KEYS.search && searchPageLoading)}
              >
                <Text style={{ color: "#111827", fontWeight: "600" }}>Previous</Text>
              </Pressable>
            ) : (
              <View />
            )}
            {pageIndex < totalPages ? (
              <Pressable
                onPress={() => goToPage(pageIndex + 1)}
                className="px-4 py-3 rounded border border-cyan-500 bg-cyan-500"
                style={{
                  opacity: pageChanging || loading || (activeTab === TAB_KEYS.search && searchPageLoading) ? 0.4 : 1,
                }}
                disabled={pageChanging || loading || (activeTab === TAB_KEYS.search && searchPageLoading)}
              >
                <Text style={{ color: "#ffffff", fontWeight: "700" }}>Next</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}


