import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Sparkles, Search, Copy, Check, ExternalLink, User, BookOpen, PenTool, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';
import { db } from '../lib/firebase';
import { collection, query, where, limit, doc, updateDoc, increment } from 'firebase/firestore';
import { safeGetDocs, safeUpdateDoc } from '../lib/firestoreUtils';
import * as localDb from '../lib/localDb';
import toast from 'react-hot-toast';
import { parseIdQuery, lookupIdInFirebase, ExactIdLookupResult } from '../lib/searchUtils';

interface GroupedResults {
  characters: any[];
  prompts: any[];
  creators: any[];
}

export default function AISearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<GroupedResults | null>(null);
  const [exactMatch, setExactMatch] = useState<ExactIdLookupResult | null>(null);
  const [criteria, setCriteria] = useState<any>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useSeo({
    title: 'Tìm kiếm bằng AI',
    description: 'Sử dụng trí tuệ nhân tạo để tìm kiếm Character, Prompt và Creator phù hợp nhất qua ngôn ngữ tự nhiên.'
  });

  const performSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    
    setLoading(true);
    setResults(null);
    setExactMatch(null);
    setCriteria(null);
    setIdError(null);
    setSearchError(null);
    try {
      // Robust ID search handling
      const idParse = parseIdQuery(queryText);
      if (idParse.isIdQuery) {
        if (idParse.error) {
          setIdError(idParse.error);
          toast.error(idParse.error);
          setLoading(false);
          return;
        }

        if (idParse.numericId) {
          const lookup = await lookupIdInFirebase(idParse.numericId, idParse.typeHint);
          if (lookup && lookup.found && lookup.result) {
            setExactMatch(lookup);
            toast.success("Đã tìm thấy đối tượng chính xác theo ID!");
            setLoading(false);
            return;
          } else {
            const missingMsg = lookup?.error || "ID không tồn tại trên hệ thống.";
            setIdError(missingMsg);
            toast.error(missingMsg);
            setLoading(false);
            return;
          }
        }
      }

      // Normal Natural Language Search via API
      const res = await apiFetch("/api/ai-search", {
        method: "POST",
        body: JSON.stringify({ query: queryText })
      });
      
      const parsedCriteria = (res as any)?.parsedCriteria || {};
      setCriteria(parsedCriteria);

      // 1. Fetch Characters
      let charQuery = query(collection(db, "characters"));
      if (parsedCriteria.gender) {
        charQuery = query(charQuery, where("gender", "==", parsedCriteria.gender));
      }
      const charSnap = await safeGetDocs(query(charQuery, limit(50)));
      let fetchedCharacters = charSnap.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((c: any) => !c.deletedAt && !c.isHidden);

      if (fetchedCharacters.length === 0) {
        fetchedCharacters = localDb.getAllCharacters().filter((c: any) => !c.deletedAt && !c.isHidden) as any[];
      }

      if (parsedCriteria.keywords && parsedCriteria.keywords.length > 0) {
        fetchedCharacters = fetchedCharacters.filter((char: any) => 
          parsedCriteria.keywords.some((kw: string) => {
            const lowerKw = kw.toLowerCase();
            return (
              (char.name || "").toLowerCase().includes(lowerKw) || 
              (char.slogan || "").toLowerCase().includes(lowerKw) ||
              (char.plot || "").toLowerCase().includes(lowerKw) ||
              (char.tags || []).some((t: string) => t.toLowerCase().includes(lowerKw))
            );
          })
        );
      }

      // 2. Fetch Prompts
      const promptSnap = await safeGetDocs(query(collection(db, "prompts"), limit(50)));
      let fetchedPrompts = promptSnap.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((p: any) => !p.deletedAt && !p.isHidden);

      if (fetchedPrompts.length === 0) {
        fetchedPrompts = localDb.getAllPrompts().filter((p: any) => !p.deletedAt && !p.isHidden) as any[];
      }

      if (parsedCriteria.keywords && parsedCriteria.keywords.length > 0) {
        fetchedPrompts = fetchedPrompts.filter((prompt: any) => 
          parsedCriteria.keywords.some((kw: string) => {
            const lowerKw = kw.toLowerCase();
            return (
              (prompt.title || prompt.name || "").toLowerCase().includes(lowerKw) || 
              (prompt.purpose || "").toLowerCase().includes(lowerKw) ||
              (prompt.content || "").toLowerCase().includes(lowerKw) ||
              (prompt.author || "").toLowerCase().includes(lowerKw) ||
              (prompt.tags || []).some((t: string) => t.toLowerCase().includes(lowerKw))
            );
          })
        );
      }

      // 3. Fetch Creators
      const creatorSnap = await safeGetDocs(query(collection(db, "users"), limit(50)));
      let fetchedCreators = creatorSnap.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((u: any) => u.role !== 'ADMIN' && u.creatorStatus === true && !u.deletedAt && !u.isLocked && !u.isHidden);

      if (fetchedCreators.length === 0) {
        fetchedCreators = localDb.getAllUsers().filter((u: any) => u.role !== 'ADMIN' && u.creatorStatus === true && !u.deletedAt && !u.isLocked && !u.isHidden) as any[];
      }

      if (parsedCriteria.keywords && parsedCriteria.keywords.length > 0) {
        fetchedCreators = fetchedCreators.filter((creator: any) => 
          parsedCriteria.keywords.some((kw: string) => {
            const lowerKw = kw.toLowerCase();
            return (
              (creator.displayName || "").toLowerCase().includes(lowerKw) || 
              (creator.bio || "").toLowerCase().includes(lowerKw)
            );
          })
        );
      }

      // If user query specifically restricts type
      if (parsedCriteria.type === 'character') {
        fetchedPrompts = [];
        fetchedCreators = [];
      } else if (parsedCriteria.type === 'prompt') {
        fetchedCharacters = [];
        fetchedCreators = [];
      } else if (parsedCriteria.type === 'creator') {
        fetchedCharacters = [];
        fetchedPrompts = [];
      }

      setResults({
        characters: fetchedCharacters,
        prompts: fetchedPrompts,
        creators: fetchedCreators
      });
    } catch (err: any) {
      console.error(err);
      setSearchError("Không thể hoàn tất tìm kiếm AI. Vui lòng kiểm tra kết nối và thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const copyToClipboard = async (text: string, promptId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPromptId(promptId);
      toast.success("Đã sao chép nội dung Prompt!");
      
      // Update copy count in firestore
      try {
        await updateDoc(doc(db, 'prompts', promptId), {
          copyCount: increment(1)
        });
      } catch (e) {
        // silent count error
      }

      setTimeout(() => setCopiedPromptId(null), 2000);
    } catch (err) {
      toast.error("Không thể sao chép văn bản.");
    }
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchQuery(q);
      performSearch(q);
    }
  }, [searchParams]);

  const totalResultsCount = (results?.characters?.length || 0) + 
                            (results?.prompts?.length || 0) + 
                            (results?.creators?.length || 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-full mb-6">
          <Sparkles className="w-8 h-8 text-neutral-900 dark:text-neutral-100" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Tìm kiếm bằng AI</h1>
        <p className="text-neutral-500 max-w-xl mx-auto">
          Mô tả bằng ngôn ngữ tự nhiên hoặc nhập mã ID trực tiếp (VD: character/123456789), hệ thống sẽ truy xuất chính xác dữ liệu từ cơ sở dữ liệu.
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto mb-12">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="VD: Tìm nữ chính hiện đại hoặc character/123456789..." 
          className="w-full pl-12 pr-32 py-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-shadow text-lg"
        />
        <button 
          type="submit" 
          disabled={loading || !searchQuery.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl font-medium disabled:opacity-50 transition-opacity"
        >
          {loading ? "Đang tìm..." : "Tìm kiếm"}
        </button>
      </form>

      {/* ID Error state */}
      {idError && (
        <div className="text-center py-12 px-6 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-3xl mt-6">
          <p className="text-lg font-bold mb-2">{idError}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Vui lòng kiểm tra lại mã ID hoặc từ khóa tìm kiếm của bạn.</p>
        </div>
      )}

      {/* API / Search Failure Error State */}
      {searchError && (
        <div className="text-center py-10 px-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-3xl mb-8">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Không thể thực hiện tìm kiếm AI</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">{searchError}</p>
          <button
            onClick={() => performSearch(searchQuery)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black font-medium text-sm rounded-xl hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Exact Match Resolution Card */}
      {!idError && exactMatch && exactMatch.result && (
        <div className="mb-10 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40 w-fit">
            <Sparkles className="w-4 h-4" />
            <span>Kết Quả Tìm Kiếm Chính Xác ID: {exactMatch.type}/{exactMatch.numericId}</span>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-lg"
          >
            {/* Character Card */}
            {exactMatch.type === 'character' && (
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="flex gap-4 items-center">
                  <img 
                    src={exactMatch.result.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${exactMatch.result.name}`} 
                    alt={exactMatch.result.name}
                    className="w-20 h-20 rounded-2xl object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200 dark:border-neutral-700" 
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{exactMatch.result.name}</h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        character/{exactMatch.numericId}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 font-medium">Được tạo bởi: <span className="text-neutral-900 dark:text-neutral-200">{exactMatch.result.creatorName}</span></p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-2">{exactMatch.result.slogan}</p>
                    
                    {exactMatch.result.tags && exactMatch.result.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {exactMatch.result.tags.map((t: string) => (
                          <span key={t} className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-md text-neutral-600 dark:text-neutral-400">#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Link 
                  to={exactMatch.path}
                  className="w-full md:w-auto px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shrink-0"
                >
                  <span>Mở Character</span>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* Prompt Card */}
            {exactMatch.type === 'prompt' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{exactMatch.result.title || exactMatch.result.name}</h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      prompt/{exactMatch.numericId}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">Tác giả: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{exactMatch.result.author || exactMatch.result.authorName}</span></p>
                </div>

                <p className="text-sm text-neutral-600 dark:text-neutral-400">{exactMatch.result.purpose}</p>

                {exactMatch.result.content && (
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 font-mono text-xs max-h-40 overflow-y-auto whitespace-pre-wrap text-neutral-800 dark:text-neutral-300">
                    {exactMatch.result.content}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
                  <button
                    onClick={() => copyToClipboard(exactMatch.result.content || "", exactMatch.id)}
                    className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    {copiedPromptId === exactMatch.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPromptId === exactMatch.id ? "Đã sao chép!" : "Sao chép Prompt"}</span>
                  </button>

                  <Link 
                    to={exactMatch.path}
                    className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-xs flex items-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <span>Mở Prompt</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Creator / User Card */}
            {(exactMatch.type === 'creator' || exactMatch.type === 'user') && (
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="flex gap-4 items-center">
                  <img 
                    src={exactMatch.result.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${exactMatch.result.displayName}`} 
                    alt={exactMatch.result.displayName}
                    className="w-16 h-16 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200 dark:border-neutral-700" 
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{exactMatch.result.displayName}</h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        {exactMatch.type}/{exactMatch.numericId}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{exactMatch.result.bio || "Chưa có tiểu sử"}</p>
                    {exactMatch.type === 'creator' && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                        <span>Character: <strong className="text-neutral-900 dark:text-neutral-100">{exactMatch.result.characterCount || 0}</strong></span>
                        <span>Prompt: <strong className="text-neutral-900 dark:text-neutral-100">{exactMatch.result.promptCount || 0}</strong></span>
                        <span>Người theo dõi: <strong className="text-neutral-900 dark:text-neutral-100">{exactMatch.result.followerCount || 0}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                <Link 
                  to={exactMatch.path}
                  className="w-full md:w-auto px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shrink-0"
                >
                  <span>{exactMatch.type === 'creator' ? "Xem Trang Creator" : "Xem Hồ Sơ"}</span>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Natural language query parsing indicator */}
      {!idError && !exactMatch && criteria && (
        <div className="mb-8 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 text-sm">
          <div className="font-medium mb-2">AI đã hiểu yêu cầu của bạn:</div>
          <div className="flex flex-wrap gap-2">
            {criteria.type && <span className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700">Loại: {criteria.type}</span>}
            {criteria.gender && <span className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700">Giới tính: {criteria.gender}</span>}
            {criteria.tags && criteria.tags.map((t: string) => <span key={t} className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700">Tag: {t}</span>)}
            {criteria.keywords && criteria.keywords.map((k: string) => <span key={k} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800">Từ khóa: {k}</span>)}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-8">
          {[1, 2].map(section => (
            <div key={section} className="space-y-4">
              <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-md animate-pulse"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map(i => <div key={i} className="h-32 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse"></div>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!idError && !searchError && !exactMatch && !loading && results && totalResultsCount === 0 && (
        <div className="text-center py-16 px-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl border-dashed">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-bold mb-2">Không tìm thấy kết quả phù hợp.</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mb-6">
            Thử nhập câu mô tả chi tiết hơn hoặc khám phá các nội dung nổi bật trong cộng đồng.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/characters"
              className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              Xem Character nổi bật
            </Link>
            <Link
              to="/prompts"
              className="px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-sm font-semibold rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Xem Prompt nổi bật
            </Link>
          </div>
        </div>
      )}

      {/* Grouped Search Results (Module 12) */}
      {!idError && !searchError && !exactMatch && !loading && results && totalResultsCount > 0 && (
        <div className="space-y-12">
          
          {/* GROUP 1: CHARACTERS */}
          {results.characters.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                  <h2 className="text-xl font-bold">Character ({results.characters.length})</h2>
                </div>
                <Link 
                  to="/characters" 
                  className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1 group transition-colors"
                >
                  <span>Xem tất cả</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.characters.map((item, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={item.id}
                  >
                    <Link to={`/character/${item.id}`} className="group p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all flex gap-4 h-full">
                      <img src={item.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.name}`} className="w-20 h-20 rounded-xl object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200 dark:border-neutral-700" alt={item.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-lg group-hover:text-blue-500 transition-colors truncate">{item.name}</h3>
                          {item.numericId && (
                            <span className="text-[10px] font-mono text-neutral-400 shrink-0">#{item.numericId}</span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 font-medium">Bởi {item.creatorName}</p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-1">{item.slogan}</p>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {item.tags.slice(0, 3).map((t: string) => <span key={t} className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-md text-neutral-600 dark:text-neutral-400">#{t}</span>)}
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* GROUP 2: PROMPTS */}
          {results.prompts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                  <h2 className="text-xl font-bold">Prompt ({results.prompts.length})</h2>
                </div>
                <Link 
                  to="/prompts" 
                  className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1 group transition-colors"
                >
                  <span>Xem tất cả</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.prompts.map((item, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={item.id}
                    className="p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/prompt/${item.id}`} className="font-bold text-lg hover:text-blue-500 transition-colors line-clamp-1">
                          {item.title || item.name}
                        </Link>
                        {item.numericId && (
                          <span className="text-[10px] font-mono text-neutral-400 shrink-0">#{item.numericId}</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 font-medium mt-0.5">Tác giả: {item.author || item.authorName}</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-2">{item.purpose}</p>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-t-neutral-100 dark:border-t-neutral-800">
                      <span className="text-xs text-neutral-500">Đã chép: {item.copyCount || 0} lượt</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(item.content || "", item.id)}
                          className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          {copiedPromptId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedPromptId === item.id ? "Đã chép" : "Sao chép"}</span>
                        </button>
                        <Link 
                          to={`/prompt/${item.id}`}
                          className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          Chi tiết
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* GROUP 3: CREATORS */}
          {results.creators.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                  <h2 className="text-xl font-bold">Creator ({results.creators.length})</h2>
                </div>
                <Link 
                  to="/creators" 
                  className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1 group transition-colors"
                >
                  <span>Xem tất cả</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.creators.map((item, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={item.id}
                  >
                    <Link to={`/creator/${item.numericId || item.id}`} className="group p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                      <img src={item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.displayName}`} className="w-16 h-16 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200 dark:border-neutral-700" alt={item.displayName} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-lg group-hover:text-blue-500 transition-colors truncate">{item.displayName}</h3>
                          {item.numericId && (
                            <span className="text-[10px] font-mono text-neutral-400 shrink-0">#{item.numericId}</span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">{item.bio || "Chưa có tiểu sử"}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                          <span>Character: <strong className="text-neutral-900 dark:text-neutral-100">{item.characterCount || 0}</strong></span>
                          <span>Followers: <strong className="text-neutral-900 dark:text-neutral-100">{item.followerCount || 0}</strong></span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

