import { useState, useEffect, ChangeEvent } from 'react';
import { read, utils } from 'xlsx';
import { Search, Plus, Trash2, Download, ExternalLink, Users, Award, Link as LinkIcon, Copy, RotateCcw, Bot, FolderPlus, FilePlus, ChevronDown, ChevronRight, CheckSquare, Square, Folder, X, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Influencer {
  id: string;
  keyword: string;
  name: string;
  url: string;
  fans: string;
  specialty: string;
}

interface KeywordGroup {
  id: string;
  name: string;
  keywords: string[];
}

export default function InfluencerManager() {
  const [isLoaded, setIsLoaded] = useState(false);

  // State for Keyword Groups
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([]);

  const [selectedKeyword, setSelectedKeyword] = useState<string>(() => {
    const saved = localStorage.getItem('naver-selected-keyword');
    if (saved) return saved;
    return '';
  });

  const [checkedKeywords, setCheckedKeywords] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('naver-checked-keywords');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('naver-expanded-groups');
    return saved ? new Set(JSON.parse(saved)) : new Set(['default']);
  });

  // Influencer Data State
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  
  const [isCrawling, setIsCrawling] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingKeywordToGroup, setAddingKeywordToGroup] = useState<string | null>(null);
  const [newKeywordName, setNewKeywordName] = useState('');

  // Fetch initial state from server
  useEffect(() => {
    fetch('/api/state')
      .then(res => res.json())
      .then(data => {
        if (data.keywordGroups) {
          setKeywordGroups(data.keywordGroups);
          // Set initial selected keyword if empty
          if (!selectedKeyword && data.keywordGroups.length > 0 && data.keywordGroups[0].keywords.length > 0) {
            setSelectedKeyword(data.keywordGroups[0].keywords[0]);
          }
        }
        if (data.influencers) setInfluencers(data.influencers);
        setIsLoaded(true);
      })
      .catch(err => console.error('Failed to fetch state:', err));
  }, []);

  // Save state to server
  useEffect(() => {
    if (!isLoaded) return;

    const timer = setTimeout(() => {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywordGroups, influencers })
      }).catch(err => console.error('Failed to save state:', err));
    }, 1000); // Debounce save

    return () => clearTimeout(timer);
  }, [keywordGroups, influencers, isLoaded]);

  // UI State Persistence (Local Storage)
  useEffect(() => {
    localStorage.setItem('naver-selected-keyword', selectedKeyword);
  }, [selectedKeyword]);

  useEffect(() => {
    localStorage.setItem('naver-checked-keywords', JSON.stringify(Array.from(checkedKeywords)));
  }, [checkedKeywords]);

  useEffect(() => {
    localStorage.setItem('naver-expanded-groups', JSON.stringify(Array.from(expandedGroups)));
  }, [expandedGroups]);

  // Keyword Management Functions
  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: KeywordGroup = {
      id: crypto.randomUUID(),
      name: newGroupName,
      keywords: []
    };
    setKeywordGroups([...keywordGroups, newGroup]);
    setNewGroupName('');
    setIsAddingGroup(false);
    setExpandedGroups(prev => new Set(prev).add(newGroup.id));
  };

  const handleAddKeyword = (groupId: string) => {
    if (!newKeywordName.trim()) return;
    setKeywordGroups(groups => groups.map(g => {
      if (g.id === groupId) {
        return { ...g, keywords: [...g.keywords, newKeywordName] };
      }
      return g;
    }));
    if (!selectedKeyword) setSelectedKeyword(newKeywordName);
    setNewKeywordName('');
    setAddingKeywordToGroup(null);
  };

  const handleDeleteKeyword = (groupId: string, keywordToDelete: string) => {
    if (confirm(`'${keywordToDelete}' 키워드를 삭제하시겠습니까?`)) {
      setKeywordGroups(groups => groups.map(g => {
        if (g.id === groupId) {
          return { ...g, keywords: g.keywords.filter(k => k !== keywordToDelete) };
        }
        return g;
      }));
      
      if (selectedKeyword === keywordToDelete) {
        setSelectedKeyword('');
      }
      
      if (checkedKeywords.has(keywordToDelete)) {
        const newChecked = new Set(checkedKeywords);
        newChecked.delete(keywordToDelete);
        setCheckedKeywords(newChecked);
      }
    }
  };

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleKeywordCheck = (keyword: string) => {
    const newChecked = new Set(checkedKeywords);
    if (newChecked.has(keyword)) {
      newChecked.delete(keyword);
    } else {
      newChecked.add(keyword);
    }
    setCheckedKeywords(newChecked);
  };

  const toggleGroupCheck = (group: KeywordGroup) => {
    const allChecked = group.keywords.every(k => checkedKeywords.has(k));
    const newChecked = new Set(checkedKeywords);
    
    if (allChecked) {
      group.keywords.forEach(k => newChecked.delete(k));
    } else {
      group.keywords.forEach(k => newChecked.add(k));
    }
    setCheckedKeywords(newChecked);
  };

  // Influencer Management Functions
  const handleAddInfluencer = () => {
    if (!selectedKeyword) return;
    const newInfluencer: Influencer = {
      id: crypto.randomUUID(),
      keyword: selectedKeyword,
      name: '',
      url: '',
      fans: '',
      specialty: ''
    };
    setInfluencers([...influencers, newInfluencer]);
  };

  const handleUpdateInfluencer = (id: string, field: keyof Influencer, value: string) => {
    setInfluencers(influencers.map(inf => 
      inf.id === id ? { ...inf, [field]: value } : inf
    ));
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>, groupId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      const newKeywords: string[] = [];
      
      jsonData.forEach(row => {
        if (row[0]) {
            const val = String(row[0]).trim();
            if (val) newKeywords.push(val);
        }
      });

      if (newKeywords.length === 0) {
        alert('파일에서 키워드를 찾을 수 없습니다.');
        return;
      }

      setKeywordGroups(groups => groups.map(g => {
        if (g.id === groupId) {
          const existing = new Set(g.keywords);
          let addedCount = 0;
          newKeywords.forEach(k => {
              if (!existing.has(k)) {
                  existing.add(k);
                  addedCount++;
              }
          });
          
          if (addedCount > 0) {
              alert(`${addedCount}개의 키워드가 추가되었습니다.`);
              return { ...g, keywords: Array.from(existing) };
          } else {
              alert('모든 키워드가 이미 존재합니다.');
              return g;
          }
        }
        return g;
      }));

    } catch (error) {
      console.error('File upload error:', error);
      alert('파일을 읽는 중 오류가 발생했습니다.');
    }
    
    event.target.value = '';
  };

  const handleDeleteInfluencer = (id: string) => {
    setInfluencers(influencers.filter(inf => inf.id !== id));
  };



  const handleClearAll = () => {
    if (confirm('모든 데이터를 삭제하시겠습니까?')) {
      setInfluencers([]);
    }
  };

  const handleCrawl = async () => {
    if (!selectedKeyword) return;
    setIsCrawling(true);
    try {
      const response = await fetch(`/api/crawl?keyword=${encodeURIComponent(selectedKeyword)}`);
      if (!response.ok) throw new Error('Failed to crawl');
      
      const data = await response.json();
      if (data.influencers && data.influencers.length > 0) {
        // Filter out duplicates based on URL
        const existingUrls = new Set(influencers.map(i => i.url));
        const newInfluencers = data.influencers.filter((i: Influencer) => !existingUrls.has(i.url));
        
        if (newInfluencers.length === 0) {
          alert('새로운 인플루언서를 찾지 못했습니다 (중복 제외).');
        } else {
          setInfluencers(prev => [...prev, ...newInfluencers]);
          alert(`${newInfluencers.length}명의 인플루언서가 추가되었습니다!`);
        }
      } else {
        alert('인플루언서를 찾을 수 없습니다. 네이버에서 요청을 차단했을 수 있습니다.');
      }
    } catch (error) {
      console.error(error);
      alert('데이터 크롤링 중 오류가 발생했습니다. 나중에 다시 시도해주세요.');
    } finally {
      setIsCrawling(false);
    }
  };

  const handleExportCSV = () => {
    const keywordsToExport = checkedKeywords.size > 0 ? Array.from(checkedKeywords) : [selectedKeyword];
    const dataToExport = influencers.filter(inf => keywordsToExport.includes(inf.keyword));

    if (dataToExport.length === 0) {
      alert('선택한 키워드에 내보낼 데이터가 없습니다.');
      return;
    }

    const headers = ['키워드', '인플루언서명', 'URL', '팬수', '전문분야'];
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(inf => 
        [inf.keyword, inf.name, inf.url, inf.fans, inf.specialty]
          .map(field => `"${field.replace(/"/g, '""')}"`) // Escape quotes
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `naver_influencers_${keywordsToExport.length > 1 ? 'bulk' : 'single'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyToClipboard = () => {
    const keywordsToExport = checkedKeywords.size > 0 ? Array.from(checkedKeywords) : [selectedKeyword];
    const dataToExport = influencers.filter(inf => keywordsToExport.includes(inf.keyword));

    if (dataToExport.length === 0) {
      alert('복사할 데이터가 없습니다.');
      return;
    }

    const headers = ['키워드', '인플루언서명', 'URL', '팬수', '전문분야'];
    const tsvContent = [
      headers.join('\t'),
      ...dataToExport.map(inf => 
        [inf.keyword, inf.name, inf.url, inf.fans, inf.specialty].join('\t')
      )
    ].join('\n');
    
    navigator.clipboard.writeText(tsvContent).then(() => {
      alert('클립보드에 복사되었습니다!');
    });
  };

  const currentInfluencers = influencers.filter(inf => inf.keyword === selectedKeyword);

  const openNaverSearch = () => {
    if (!selectedKeyword) return;
    window.open(`https://search.naver.com/search.naver?where=influencer&query=${encodeURIComponent(selectedKeyword)}`, '_blank');
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 flex-shrink-0">
        <div className="p-5 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Search className="w-5 h-5 text-emerald-600" />
            <span>인플루언서 스카우트</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">네이버 키워드 매니저</p>
        </div>
        
        {/* Keyword List */}
        <div className="flex-1 overflow-y-auto py-2">
          {keywordGroups.map(group => (
            <div key={group.id} className="mb-1">
              {/* Group Header */}
              <div className="flex items-center px-3 py-1.5 hover:bg-slate-50 group/header">
                <button 
                  onClick={() => toggleGroupExpansion(group.id)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  {expandedGroups.has(group.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                
                <button 
                  onClick={() => toggleGroupCheck(group)}
                  className="p-1 text-slate-400 hover:text-emerald-600"
                >
                  {group.keywords.length > 0 && group.keywords.every(k => checkedKeywords.has(k)) ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>

                <span className="flex-1 text-sm font-semibold text-slate-700 ml-1 truncate">{group.name}</span>
                
                <label 
                  className="opacity-0 group-hover/header:opacity-100 p-1 text-slate-400 hover:text-emerald-600 transition-opacity cursor-pointer"
                  title="파일로 키워드 일괄 추가 (CSV, Excel)"
                >
                  <Upload className="w-4 h-4" />
                  <input 
                    type="file" 
                    accept=".csv,.xlsx,.xls" 
                    className="hidden" 
                    onChange={(e) => handleFileUpload(e, group.id)}
                  />
                </label>

                <button 
                  onClick={() => setAddingKeywordToGroup(group.id)}
                  className="opacity-0 group-hover/header:opacity-100 p-1 text-slate-400 hover:text-emerald-600 transition-opacity"
                  title="키워드 추가"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Keywords in Group */}
              <AnimatePresence>
                {expandedGroups.has(group.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {group.keywords.map(keyword => {
                      const count = influencers.filter(i => i.keyword === keyword).length;
                      return (
                        <div 
                          key={keyword}
                          className={`flex items-center px-3 py-1 pl-9 transition-colors group ${
                            selectedKeyword === keyword ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <button
                            onClick={() => toggleKeywordCheck(keyword)}
                            className="mr-2 text-slate-400 hover:text-emerald-600"
                          >
                            {checkedKeywords.has(keyword) ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Square className="w-3.5 h-3.5" />
                            )}
                          </button>
                          
                          <button
                            onClick={() => setSelectedKeyword(keyword)}
                            className={`flex-1 text-left truncate text-sm ${
                              selectedKeyword === keyword ? 'text-emerald-700 font-medium' : 'text-slate-600'
                            }`}
                          >
                            {keyword}
                          </button>
                          
                          {count > 0 && (
                            <span className="ml-2 bg-slate-100 text-slate-500 text-[10px] px-1.5 rounded-full font-mono">
                              {count}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteKeyword(group.id, keyword);
                            }}
                            className="ml-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="키워드 삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}

                    {/* Add Keyword Input */}
                    {addingKeywordToGroup === group.id && (
                      <div className="pl-9 pr-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={newKeywordName}
                            onChange={(e) => setNewKeywordName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddKeyword(group.id);
                              if (e.key === 'Escape') {
                                setAddingKeywordToGroup(null);
                                setNewKeywordName('');
                              }
                            }}
                            placeholder="새 키워드..."
                            className="w-full text-xs px-2 py-1 border border-emerald-200 rounded focus:outline-none focus:border-emerald-500"
                          />
                          <button 
                            onClick={() => handleAddKeyword(group.id)}
                            className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => {
                              setAddingKeywordToGroup(null);
                              setNewKeywordName('');
                            }}
                            className="p-1 bg-slate-200 text-slate-500 rounded hover:bg-slate-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {/* Add Group Input */}
          {isAddingGroup ? (
            <div className="px-3 py-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddGroup();
                    if (e.key === 'Escape') {
                      setIsAddingGroup(false);
                      setNewGroupName('');
                    }
                  }}
                  placeholder="그룹 이름..."
                  className="flex-1 text-sm px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-emerald-500"
                />
                <button 
                  onClick={handleAddGroup}
                  className="p-1 bg-slate-800 text-white rounded hover:bg-slate-700"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => {
                    setIsAddingGroup(false);
                    setNewGroupName('');
                  }}
                  className="p-1 bg-slate-200 text-slate-500 rounded hover:bg-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingGroup(true)}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition-colors border-t border-slate-100"
            >
              <FolderPlus className="w-4 h-4" />
              새 그룹 추가
            </button>
          )}
        </div>

        {/* Sidebar Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
          <button
            onClick={handleExportCSV}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4" />
            {checkedKeywords.size > 0 ? `선택 항목 내보내기 (${checkedKeywords.size})` : '현재 항목 내보내기'}
          </button>
          <button
            onClick={handleCopyToClipboard}
            className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 px-4 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95"
          >
            <Copy className="w-4 h-4" />
            표 복사
          </button>
          <div className="flex gap-2 pt-2">
 
            <button
              onClick={handleClearAll}
              className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-red-600 py-2 hover:bg-red-50 rounded transition-colors"
              title="전체 삭제"
            >
              <Trash2 className="w-3 h-3" />
              전체 삭제
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-center shadow-sm flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{selectedKeyword || '키워드 선택'}</h2>
            <p className="text-slate-500 text-sm mt-1">
              {selectedKeyword ? '이 키워드의 인플루언서 관리' : '시작하려면 사이드바에서 키워드를 선택하세요'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCrawl}
              disabled={isCrawling || !selectedKeyword}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                isCrawling || !selectedKeyword
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isCrawling ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  크롤링 중...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  자동 크롤링
                </>
              )}
            </button>
            <button
              onClick={openNaverSearch}
              disabled={!selectedKeyword}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                !selectedKeyword
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              네이버 검색
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>
            <button
              onClick={handleAddInfluencer}
              disabled={!selectedKeyword}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                !selectedKeyword
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              인플루언서 추가
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="popLayout">
            {!selectedKeyword ? (
               <div className="flex flex-col items-center justify-center h-full text-slate-400">
                 <Search className="w-12 h-12 mb-4 opacity-20" />
                 <p>인플루언서를 보려면 키워드를 선택하세요</p>
               </div>
            ) : currentInfluencers.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50"
              >
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">추가된 인플루언서가 없습니다</h3>
                <p className="text-slate-500 max-w-sm mt-2 mb-6">
                  '자동 크롤링'을 클릭하여 데이터를 자동으로 가져오거나, '네이버 검색'을 통해 수동으로 찾으세요.
                </p>
                <div className="flex gap-4">
                   <button
                    onClick={handleCrawl}
                    className="text-indigo-600 font-medium hover:text-indigo-700 hover:underline flex items-center gap-1"
                  >
                    <Bot className="w-4 h-4" />
                    자동 크롤링
                  </button>
                  <button
                    onClick={openNaverSearch}
                    className="text-emerald-600 font-medium hover:text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Search className="w-4 h-4" />
                    지금 검색
                  </button>
                  <button
                    onClick={handleAddInfluencer}
                    className="text-emerald-600 font-medium hover:text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    수동 추가
                  </button>
                </div>
               
              </motion.div>
            ) : (
              <div className="grid gap-4">
                {currentInfluencers.map((inf) => (
                  <motion.div
                    key={inf.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 group hover:shadow-md transition-shadow"
                  >
                    <div className="grid grid-cols-12 gap-4 items-start">
                      <div className="col-span-3">
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">이름</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={inf.name}
                            onChange={(e) => handleUpdateInfluencer(inf.id, 'name', e.target.value)}
                            placeholder="인플루언서 이름"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-900"
                          />
                        </div>
                      </div>
                      
                      <div className="col-span-4">
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">URL</label>
                        <div className="relative">
                          <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={inf.url}
                            onChange={(e) => handleUpdateInfluencer(inf.id, 'url', e.target.value)}
                            placeholder="https://in.naver.com/..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono text-slate-600"
                          />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">팬 수</label>
                        <div className="relative">
                          <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={inf.fans}
                            onChange={(e) => handleUpdateInfluencer(inf.id, 'fans', e.target.value)}
                            placeholder="예: 1.2k"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">전문 분야</label>
                        <div className="relative">
                          <Award className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={inf.specialty}
                            onChange={(e) => handleUpdateInfluencer(inf.id, 'specialty', e.target.value)}
                            placeholder="예: 다이어트"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      </div>

                      <div className="col-span-1 flex justify-end pt-6">
                        <button
                          onClick={() => handleDeleteInfluencer(inf.id)}
                          className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
