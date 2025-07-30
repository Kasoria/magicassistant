import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Filter, Download, RefreshCw, Sun, Moon, Bot, Settings, AlertTriangle, Info, AlertCircle, X } from 'lucide-react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { Kbd } from 'flowbite-react'

const DebugApp = () => {
  const [darkMode, setDarkMode] = useState(false)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)
  const [fileContent, setFileContent] = useState(null)
  const [fileContentLoading, setFileContentLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [analyzingError, setAnalyzingError] = useState(false)
  const [aiProvider, setAiProvider] = useState('openai')
  const [isEditing, setIsEditing] = useState(false)
  const [editingContent, setEditingContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const searchInputRef = useRef(null)
  const editTextareaRef = useRef(null)
  const fetchController = useRef(null)
  const aiAnalysisRef = useRef(null)

  // Get configuration from global variable
  const config = window.matDebugConfig || {}
  const { wpLoaded, restUrl, pluginUrl, isStandalone, fileEditingEnabled } = config

  // Fetch logs from the API
  const fetchLogs = useCallback(async (pageOverride, perPageOverride) => {
    // Abort previous fetch if any
    if (fetchController.current) {
      fetchController.current.abort()
    }
    const controller = new AbortController()
    fetchController.current = controller
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: perPageOverride ? String(perPageOverride) : String(perPage),
        search: searchTerm,
        level: levelFilter,
        page: pageOverride ? String(pageOverride) : String(page),
        per_page: perPageOverride ? String(perPageOverride) : String(perPage)
      })
      
      let url = ''
      if (wpLoaded && restUrl) {
        url = `${restUrl}debug-view/logs?${params}`
      } else {
        // Fallback for when WordPress is not loaded
        url = `/debug-api.php?action=get_logs&${params}`
      }
      
      const response = await fetch(url, {
        credentials: 'same-origin',
        signal: controller.signal
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      if (!controller.signal.aborted) {
        if (data.success) {
          setLogs(data.data.logs || [])
          setTotalCount(data.data.total_count || 0)
          setHasMore(data.data.has_more || false)
          setPage(data.data.page || 1)
          setPerPage(data.data.per_page || 100)
        } else {
          console.error('Failed to fetch logs:', data)
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // Ignore aborted fetch
        return
      }
      console.error('Error fetching logs:', error)
      // Fallback to parsing client-side logs if API fails
      setLogs(getFallbackLogs())
      setTotalCount(2)
      setHasMore(false)
    } finally {
      if (!fetchController.current?.signal.aborted) {
        setLoading(false)
      }
    }
  }, [searchTerm, levelFilter, wpLoaded, restUrl, pluginUrl, page, perPage])

  // Get fallback logs when API is not available
  const getFallbackLogs = () => {
    return [
      {
        id: '1',
        timestamp: Date.now() / 1000,
        formatted_time: new Date().toISOString().replace('T', ' ').replace('Z', ''),
        level: 'ERROR',
        message: 'WordPress database error for query...',
        source: 'WordPress',
        file_path: '/wp-includes/wp-db.php',
        line_number: 1924,
        full_message: 'WordPress database error for query... [DATABASE ERROR MESSAGE]'
      },
      {
        id: '2',
        timestamp: Date.now() / 1000 - 300,
        formatted_time: new Date(Date.now() - 300000).toISOString().replace('T', ' ').replace('Z', ''),
        level: 'WARNING',
        message: 'PHP Warning: Undefined array key...',
        source: 'PHP',
        file_path: '/wp-content/themes/example/functions.php',
        line_number: 45,
        full_message: 'PHP Warning: Undefined array key "example" in /wp-content/themes/example/functions.php on line 45'
      }
    ]
  }

  // Fetch file content for debugging
  const fetchFileContent = async (filePath, lineNumber, contextLines = 20) => {
    try {
      const params = new URLSearchParams({
        file_path: filePath,
        line_number: lineNumber.toString(),
        context_lines: contextLines.toString()
      })
      
      let url = ''
      if (wpLoaded && restUrl) {
        url = `${restUrl}debug-view/file-content?${params}`
      } else {
        // Standalone fallback when WordPress is not loaded
        url = `/debug-api.php?action=get_file_content&${params}`
      }
      
      const response = await fetch(url, {
        credentials: 'same-origin'
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setFileContent(data.data)
        }
        return data
      }
    } catch (error) {
      console.error('Error fetching file content:', error)
      return {
        success: false,
        message: 'Failed to load file content'
      }
    }
  }

  // Analyze error with AI
  const analyzeWithAi = async (log) => {
    if (!wpLoaded || !restUrl) {
      // Standalone mode: use debug-api.php?action=ai_chat
      setAiAnalysis('');
      setAnalyzingError(true);
      try {
        // Ensure we have up-to-date code context for the AI request
        let effectiveFileContent = fileContent;
        if (!effectiveFileContent && log.file_path && log.line_number) {
          const result = await fetchFileContent(log.file_path, log.line_number);
          if (result && result.success) {
            effectiveFileContent = result.data;
          }
        }

        const contextCode = effectiveFileContent
          ? effectiveFileContent.context_content.map(line => `${line.line_number}: ${line.content}`).join('\n')
          : '';
        const response = await fetch('/debug-api.php?action=ai_chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            message: `Please respond in markdown format. Wrap the entire answer between horizontal rules (---). Use the following section headings:
### Easy-to-Understand Solution
### Explanation
### Best Practices

Then analyze the error below and provide content under each heading:

Error: ${log.full_message}
File: ${log.file_path}
Line: ${log.line_number}

Code Context:
${contextCode}`,
            provider: aiProvider
          })
        });
        const data = await response.json();
        if (data.success) {
          setAiAnalysis(data.response);
        } else {
          setAiAnalysis('Failed to analyze error: ' + (data.message || 'Unknown error'));
        }
      } catch (e) {
        setAiAnalysis('Failed to connect to AI service.');
      } finally {
        setAnalyzingError(false);
      }
      return;
    }

    try {
      setAnalyzingError(true)
      
      const requestData = {
        error_message: log.full_message,
        file_path: log.file_path,
        line_number: log.line_number,
        context_code: fileContent ? 
          fileContent.context_content.map(line => `${line.line_number}: ${line.content}`).join('\n') 
          : '' // In WP-loaded mode we assume fileContent is available, otherwise endpoint will fetch it server-side
      }
      
      const response = await fetch(`${restUrl}debug-view/analyze-error`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify(requestData)
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAiAnalysis(data.analysis)
        } else {
          setAiAnalysis('Failed to analyze error. Please check your AI provider settings.')
        }
      }
    } catch (error) {
      console.error('Error analyzing with AI:', error)
      setAiAnalysis('Failed to connect to AI service. Please check your settings.')
    } finally {
      setAnalyzingError(false)
    }
  }

  // Download logs
  const downloadLogs = () => {
    const logData = logs.map(log => ({
      timestamp: log.formatted_time,
      level: log.level,
      source: log.source,
      message: log.full_message,
      file: log.file_path,
      line: log.line_number
    }))
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `magicassistant-debug-logs-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Get log level icon and color
  const getLogLevelStyle = (level) => {
    switch (level) {
      case 'Fatal':
        return { icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30' }
      case 'Error':
        return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' }
      case 'Parse':
        return { icon: AlertCircle, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/20' }
      case 'Warning':
        return { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' }
      case 'Notice':
        return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' }
      default:
        return { icon: Info, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-900/20' }
    }
  }

  // Handle log selection
  const selectLog = async (log) => {
    setSelectedLog(log)
    setFileContent(null)
    setFileContentLoading(false)
    
    if (log.file_path && log.line_number) {
      setFileContentLoading(true)
      await fetchFileContent(log.file_path, log.line_number)
      setFileContentLoading(false)
    }
  }

  // Handle entering edit mode for file content
  const enterEditMode = async () => {
    if (!selectedLog?.file_path || !selectedLog?.line_number) return
    
    // Check if file editing is enabled
    if (!fileEditingEnabled) {
      alert('File editing is disabled. Please enable it in MagicAssistant settings under AI Configuration → Emergency Debug View.')
      return
    }
    
    setIsEditing(true)
    setFileContentLoading(true)
    const totalLines = fileContent?.total_lines || 1000000
    const result = await fetchFileContent(selectedLog.file_path, selectedLog.line_number, totalLines)
    setFileContentLoading(false)
    if (result?.success) {
      const fullContent = result.data.context_content.map(line => line.content).join('\n')
      setEditingContent(fullContent)
    } else {
      alert('Failed to load file for editing: ' + (result.message || 'Unknown error'))
    }
  }

  // Cancel edit mode
  const cancelEdit = async () => {
    setIsEditing(false)
    setEditingContent('')
    // After canceling, we must restore the original, smaller code snippet view
    // because enterEditMode loaded the entire file content into state.
    if (selectedLog?.file_path && selectedLog?.line_number) {
        setFileContentLoading(true)
        await fetchFileContent(selectedLog.file_path, selectedLog.line_number)
        setFileContentLoading(false)
    }
  }

  // Save edited file content
  const saveFileContent = async () => {
    if (!selectedLog) return
    
    if (!fileEditingEnabled) {
      alert('File editing is disabled. Please enable it in MagicAssistant settings under AI Configuration → Emergency Debug View.')
      return
    }
    
    if (!isStandalone) {
      alert('File editing is only available in standalone debug mode.')
      return
    }
    
    setSaving(true)
    try {
      const url = `/debug-api.php?action=save_file_content`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          file_path: selectedLog.file_path,
          content: editingContent
        })
      })
      const data = await response.json()
      if (data.success) {
        setIsEditing(false)
        // Reload snippet after save
        setFileContentLoading(true)
        await fetchFileContent(selectedLog.file_path, selectedLog.line_number)
        setFileContentLoading(false)
        alert('File saved successfully.')
      } else {
        alert('Save failed: ' + (data.message || 'Unknown error'))
      }
    } catch (e) {
      alert('Error saving file: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    let interval
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 5000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, fetchLogs])

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // If a modal or native dialog is open, ignore
      if (document.querySelector('dialog[open], [role="dialog"][open], .ReactModal__Overlay, .modal, .Dialog-root')) return;

      // If editing and textarea is focused, ignore all shortcuts
      if (isEditing && editTextareaRef.current && document.activeElement === editTextareaRef.current) {
        return;
      }
      // If search input is focused, ignore all shortcuts
      if (searchInputRef.current && document.activeElement === searchInputRef.current) {
        return;
      }
      // Ignore if any input, textarea, or select is focused (except for our shortcuts)
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (["input", "textarea", "select"].includes(tag) && document.activeElement !== searchInputRef.current && document.activeElement !== editTextareaRef.current) {
        return;
      }
      // Only trigger on unmodified key (no ctrl/cmd/alt/shift)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'r':
        case 'R':
          e.preventDefault();
          fetchLogs();
          break;
        case '/':
          e.preventDefault();
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          setLevelFilter('Fatal');
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          setLevelFilter('Error');
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          setLevelFilter('Warning');
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          setLevelFilter('Notice');
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setLevelFilter('Parse');
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          setLevelFilter('');
          break;
        case 'a':
        case 'A':
          e.preventDefault();
          setAutoRefresh((prev) => !prev);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          setDarkMode((prev) => !prev);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, fetchLogs]);

  // When search/filter changes, reset to page 1
  useEffect(() => {
    setPage(1)
  }, [searchTerm, levelFilter])

  // Fetch logs when page, perPage, search, or filter changes
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs, page, perPage])

  // Scroll to AI Analysis when it appears
  useEffect(() => {
    if (aiAnalysis && aiAnalysisRef.current) {
      aiAnalysisRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // After scroll, trigger a resize event to force SplitPane to recalculate layout
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 150)
    }
  }, [aiAnalysis])

  return (
    <div className={`h-screen bg-white dark:bg-gray-900 transition-colors duration-200 flex flex-col overflow-hidden ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                🔧 MagicAssistant Debug View
                {!wpLoaded && (
                  <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                    Emergency Mode
                  </span>
                )}
              </h1>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500 select-none pointer-events-none">
                  <Kbd className="!px-1 !py-0.5 !text-xs">/</Kbd>
                </span>
              </div>
              
              {/* Level Filter */}
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Levels <Kbd className="!px-1 !py-0.5 !text-xs ml-1">Z</Kbd></option>
                <option value="Fatal">Fatal <Kbd className="!px-1 !py-0.5 !text-xs ml-1">F</Kbd></option>
                <option value="Error">Error <Kbd className="!px-1 !py-0.5 !text-xs ml-1">E</Kbd></option>
                <option value="Parse">Parse <Kbd className="!px-1 !py-0.5 !text-xs ml-1">P</Kbd></option>
                <option value="Warning">Warning <Kbd className="!px-1 !py-0.5 !text-xs ml-1">W</Kbd></option>
                <option value="Notice">Notice <Kbd className="!px-1 !py-0.5 !text-xs ml-1">N</Kbd></option>
              </select>
              
              {/* Auto Refresh */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
                  autoRefresh 
                    ? 'bg-blue-500 text-white border-blue-500' 
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                <Kbd className="ml-2 !px-1 !py-0.5 !text-xs !rounded-lg !bg-gray-100 !border !border-gray-200 !font-semibold !text-gray-800 dark:!bg-gray-600 dark:!border-gray-500 dark:!text-gray-100">A</Kbd>
              </button>
              
              {/* Download */}
              <button
                onClick={downloadLogs}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
              >
                <Download className="w-4 h-4" />
              </button>
              
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <Kbd className="ml-2 !px-1 !py-0.5 !text-xs !rounded-lg !bg-gray-100 !border !border-gray-200 !font-semibold !text-gray-800 dark:!bg-gray-600 dark:!border-gray-500 dark:!text-gray-100">M</Kbd>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <PanelGroup direction="horizontal" className="flex-1 min-h-0" style={{ height: '100%' }}>
        {/* Logs List */}
        <Panel defaultSize={50} minSize={20} className="h-full overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Debug Logs ({totalCount})
                </h2>
                <button
                  onClick={() => fetchLogs()}
                  disabled={loading}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {loading ? 'Loading...' : (<><span>Refresh</span> <Kbd className="ml-2 !px-1 !py-0.5 !text-xs !rounded-lg !bg-gray-100 !border !border-gray-200 !font-semibold !text-gray-800 dark:!bg-gray-600 dark:!border-gray-500 dark:!text-gray-100">R</Kbd></>)}
                </button>
              </div>
              {/* Pagination Controls */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  Page {page} of {Math.max(1, Math.ceil(totalCount / perPage))}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => { if (page > 1) { setPage(page - 1); } }}
                    disabled={page === 1 || loading}
                    className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => { if (hasMore) { setPage(page + 1); } }}
                    disabled={!hasMore || loading}
                    className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                  <select
                    value={perPage}
                    onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                    className="ml-2 px-2 py-1 text-xs dark:text-white dark:bg-gray-700 border rounded"
                  >
                    {[25, 50, 100, 200, 500].map(n => (
                      <option key={n} value={n}>{n} per page</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No logs found matching your criteria.
                    </div>
                  ) : (
                    logs.map((log) => {
                      const levelStyle = getLogLevelStyle(log.level)
                      const LogIcon = levelStyle.icon
                      
                      return (
                        <div
                          key={log.id}
                          onClick={() => selectLog(log)}
                          className={`p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                            selectedLog?.id === log.id 
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' 
                              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`p-1 rounded ${levelStyle.bg}`}>
                              <LogIcon className={`w-4 h-4 ${levelStyle.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-medium px-2 py-1 rounded ${levelStyle.bg} ${levelStyle.color}`}>
                                  {log.level}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {log.formatted_time}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white truncate">
                                {log.message}
                              </p>
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-medium">{log.source}</span>
                                {log.file_path && (
                                  <span className="ml-2">
                                    {log.file_path}:{log.line_number}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-700 cursor-col-resize" />
        {/* Log Details */}
        <Panel defaultSize={50} className="h-full overflow-hidden bg-white dark:bg-gray-900 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {selectedLog ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Log Details
                  </h2>
                  <div className="flex items-center space-x-2">
                    <select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value)}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                    <button
                      onClick={() => analyzeWithAi(selectedLog)}
                      disabled={analyzingError}
                      className="flex items-center space-x-2 px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Bot className="w-4 h-4" />
                      <span>{analyzingError ? 'Analyzing...' : 'AI Analyze'}</span>
                    </button>
                  </div>
                </div>
                
                {/* Log Info */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">Level:</strong>
                      <span className="ml-2 text-gray-900 dark:text-white">{selectedLog.level}</span>
                    </div>
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">Source:</strong>
                      <span className="ml-2 text-gray-900 dark:text-white">{selectedLog.source}</span>
                    </div>
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">Time:</strong>
                      <span className="ml-2 text-gray-900 dark:text-white">{selectedLog.formatted_time}</span>
                    </div>
                    {selectedLog.file_path && (
                      <div>
                        <strong className="text-gray-700 dark:text-gray-300">File:</strong>
                        <span className="ml-2 text-gray-900 dark:text-white">
                          {selectedLog.file_path}:{selectedLog.line_number}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Full Message */}
                <div className="mb-4">
                  <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">Full Message</h3>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm text-gray-900 dark:text-white overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.full_message}
                  </pre>
                </div>
                
                {/* File Content / Code Context */}
                {selectedLog?.file_path && selectedLog?.line_number && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-md font-semibold text-gray-900 dark:text-white">
                        Code Context ({selectedLog.file_path}:{selectedLog.line_number})
                      </h3>
                      <div className="flex space-x-2">
                        {!isEditing ? (
                          fileEditingEnabled ? (
                            <button
                              onClick={enterEditMode}
                              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                            >
                              Edit
                            </button>
                          ) : (
                            <button
                              disabled
                              className="px-3 py-1 text-sm bg-gray-400 text-gray-600 rounded cursor-not-allowed transition-colors"
                              title="File editing is disabled in settings"
                            >
                              Edit (Disabled)
                            </button>
                          )
                        ) : (
                          <>
                            <button
                              onClick={saveFileContent}
                              disabled={saving}
                              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {fileContentLoading && (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                      </div>
                    )}
                    {!fileContentLoading && fileContent && (
                      isEditing ? (
                        <textarea
                          ref={editTextareaRef}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full h-96 p-4 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm rounded-lg"
                        />
                      ) : (
                        <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto">
                          <code className="text-sm font-mono block">
                            {fileContent.context_content.map((line, index) => (
                              <div
                                key={index}
                                className={`flex ${
                                  line.is_error_line 
                                    ? 'bg-red-900/30 text-red-200' 
                                    : 'text-gray-300'
                                }`}
                              >
                                <span className="text-gray-500 w-12 flex-shrink-0 text-right mr-4">
                                  {line.line_number}
                                </span>
                                <span className="flex-1 whitespace-pre-wrap">
                                  {line.content}
                                </span>
                              </div>
                            ))}
                          </code>
                        </div>
                      )
                    )}
                    {!fileContentLoading && !fileContent && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-4 rounded">
                        Unable to load code context for this file.
                      </div>
                    )}
                    
                    {/* File editing status info */}
                    {!fileEditingEnabled && !isEditing && fileContent && (
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <strong>🔒 File Editing Disabled:</strong> File editing is currently disabled for security. 
                          To enable file editing, go to MagicAssistant Settings → AI Configuration → Emergency Debug View and enable "Allow File Editing".
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {/* AI Analysis (appended, not modal) */}
                {aiAnalysis && (
                  <div className="mt-6" ref={aiAnalysisRef}>
                    <h3 className="text-md font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center">
                      <Bot className="w-5 h-5 mr-2 text-purple-500" />
                      AI Error Analysis
                    </h3>
                    <div className="mat-markdown whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded border">
                      <ReactMarkdown>
                        {aiAnalysis}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a log entry to view details</p>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}

export default DebugApp 