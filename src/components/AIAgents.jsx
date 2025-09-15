import { useState, useEffect, useRef } from 'react'
import { Button, Card, Badge, Spinner, TextInput, Label, Select, Textarea } from 'flowbite-react'
import FormModal from './FormModal'
import { useToast } from './Toast'

// Searchable Knowledge Base Dropdown Component
const SearchableKBDropdown = ({ knowledgeBaseEntries, selectedIds, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  // Filter KB entries based on search term
  const filteredEntries = knowledgeBaseEntries.filter(kb => 
    kb.is_active && (
      kb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (kb.category && kb.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (kb.description && kb.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  )

  // Get selected entries for display
  const selectedEntries = knowledgeBaseEntries.filter(kb => 
    selectedIds.includes(parseInt(kb.id))
  )

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleEntry = (entryId) => {
    const newSelectedIds = selectedIds.includes(entryId)
      ? selectedIds.filter(id => id !== entryId)
      : [...selectedIds, entryId]
    
    onChange(newSelectedIds)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-4 py-2.5 inline-flex items-center w-full justify-between dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700"
      >
        <span>
          {selectedEntries.length > 0 
            ? `${selectedEntries.length} KB entries selected`
            : 'Select Knowledge Base entries'}
        </span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 dark:bg-gray-700 dark:border-gray-600 max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-600">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="Search KB entries..."
              />
            </div>
          </div>

          {/* KB Entries List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredEntries.length > 0 ? (
              filteredEntries.map((kb) => (
                <div key={kb.id} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                  <input
                    type="checkbox"
                    id={`kb-${kb.id}`}
                    checked={selectedIds.includes(parseInt(kb.id))}
                    onChange={() => handleToggleEntry(parseInt(kb.id))}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label htmlFor={`kb-${kb.id}`} className="ml-3 flex-1 cursor-pointer">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {kb.name}
                    </div>
                    {kb.category && (
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        {kb.category}
                      </div>
                    )}
                    {kb.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {kb.description}
                      </div>
                    )}
                  </label>
                </div>
              ))
            ) : (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                {searchTerm ? 'No KB entries found matching your search.' : 'No KB entries available.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Entries Tags */}
      {selectedEntries.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedEntries.map((entry) => (
            <span
              key={entry.id}
              className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-300"
            >
              {entry.name}
              <button
                type="button"
                onClick={() => handleToggleEntry(parseInt(entry.id))}
                className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const AIAgents = ({ adminData, settings }) => {
  const [activeTab, setActiveTab] = useState('agents')
  const [agents, setAgents] = useState([])
  const [knowledgeBaseEntries, setKnowledgeBaseEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [showKBModal, setShowKBModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState(null)
  const [editingKB, setEditingKB] = useState(null)
  const { showSuccess, showError } = useToast()

  // Form states
  const [agentForm, setAgentForm] = useState({
    name: '',
    description: '',
    system_message: '',
    tonality: 'professional',
    response_length: 'medium',
    temperature: 0.7,
    max_tokens: 2000,
    knowledge_base_ids: [],
    is_active: true
  })

  const [kbForm, setKbForm] = useState({
    name: '',
    description: '',
    content: '',
    tags: '',
    category: '',
    is_active: true,
    content_source: 'text', // 'text', 'file', 'url'
    source_url: '',
    uploaded_file: null
  })
  
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    if (!adminData?.restUrl) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Load agents and knowledge base entries
      const [agentsResponse, kbResponse] = await Promise.all([
        fetch(`${adminData.restUrl}ai-agents`, {
          headers: {
            'X-WP-Nonce': adminData.nonces.wp_rest,
          },
        }),
        fetch(`${adminData.restUrl}knowledge-base`, {
          headers: {
            'X-WP-Nonce': adminData.nonces.wp_rest,
          },
        })
      ])

      if (agentsResponse.ok) {
        const agentsData = await agentsResponse.json()
        if (agentsData.success) {
          setAgents(agentsData.data || [])
        }
      }

      if (kbResponse.ok) {
        const kbData = await kbResponse.json()
        if (kbData.success) {
          setKnowledgeBaseEntries(kbData.data || [])
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetAgentForm = () => {
    setAgentForm({
      name: '',
      description: '',
      system_message: '',
      tonality: 'professional',
      response_length: 'medium',
      temperature: 0.7,
      max_tokens: 2000,
      knowledge_base_ids: [],
      is_active: true
    })
    setEditingAgent(null)
  }

  const resetKBForm = () => {
    setKbForm({
      name: '',
      description: '',
      content: '',
      tags: '',
      category: '',
      is_active: true,
      content_source: 'text',
      source_url: '',
      uploaded_file: null
    })
    setEditingKB(null)
    setIsProcessing(false)
  }

  const handleCreateAgent = () => {
    resetAgentForm()
    setShowAgentModal(true)
  }

  const handleEditAgent = (agent) => {
    setAgentForm({
      name: agent.name || '',
      description: agent.description || '',
      system_message: agent.system_message || '',
      tonality: agent.tonality || 'professional',
      response_length: agent.response_length || 'medium',
      temperature: parseFloat(agent.temperature) || 0.7,
      max_tokens: parseInt(agent.max_tokens) || 2000,
      knowledge_base_ids: agent.knowledge_base_ids ? agent.knowledge_base_ids.split(',').map(id => parseInt(id)).filter(id => id > 0) : [],
      is_active: agent.is_active === '1' || agent.is_active === 1
    })
    setEditingAgent(agent)
    setShowAgentModal(true)
  }

  const handleSaveAgent = async () => {
    if (!adminData?.restUrl || !agentForm.name.trim()) {
      showError('Agent name is required')
      return
    }

    try {
      const url = editingAgent 
        ? `${adminData.restUrl}ai-agents/${editingAgent.id}`
        : `${adminData.restUrl}ai-agents`
      
      const response = await fetch(url, {
        method: editingAgent ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify(agentForm)
      })

      const result = await response.json()
      
      if (result.success) {
        showSuccess(editingAgent ? 'Agent updated successfully' : 'Agent created successfully')
        setShowAgentModal(false)
        resetAgentForm()
        loadData()
      } else {
        showError(result.message || 'Failed to save agent')
      }
    } catch (error) {
      console.error('Failed to save agent:', error)
      showError('Failed to save agent. Please try again.')
    }
  }

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return
    }

    try {
      const response = await fetch(`${adminData.restUrl}ai-agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })

      const result = await response.json()
      
      if (result.success) {
        showSuccess('Agent deleted successfully')
        loadData()
      } else {
        showError(result.message || 'Failed to delete agent')
      }
    } catch (error) {
      console.error('Failed to delete agent:', error)
      showError('Failed to delete agent. Please try again.')
    }
  }

  const handleCreateKB = () => {
    resetKBForm()
    setShowKBModal(true)
  }

  const handleEditKB = (kb) => {
    setKbForm({
      name: kb.name || '',
      description: kb.description || '',
      content: kb.content || '',
      tags: kb.tags || '',
      category: kb.category || '',
      is_active: kb.is_active === '1' || kb.is_active === 1,
      content_source: 'text', // Default to text for existing entries
      source_url: '',
      uploaded_file: null
    })
    setEditingKB(kb)
    setShowKBModal(true)
  }

  const handleFileUpload = async (file) => {
    if (!file) return

    setIsProcessing(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${adminData.restUrl}knowledge-base/process-file`, {
        method: 'POST',
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: formData
      })

      const result = await response.json()
      
      if (result.success) {
        if (result.data.file_type === 'image') {
          // Handle image files - store image info for attachment
          setKbForm({
            ...kbForm, 
            content: result.data.content,
            uploaded_file: {
              ...file,
              attachment_id: result.data.attachment_id,
              file_url: result.data.file_url,
              file_path: result.data.file_path,
              file_type: 'image'
            }
          })
          showSuccess('Image file saved successfully')
        } else {
          // Handle text files - display extracted content
          setKbForm({...kbForm, content: result.data.content, uploaded_file: file})
          showSuccess('Text file processed successfully')
        }
      } else {
        showError(result.message || 'Failed to process file')
      }
    } catch (error) {
      console.error('Failed to process file:', error)
      showError('Failed to process file. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUrlScraping = async (url) => {
    if (!url.trim()) {
      showError('Please enter a valid URL')
      return
    }

    setIsProcessing(true)
    
    try {
      const response = await fetch(`${adminData.restUrl}knowledge-base/scrape-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({ url: url.trim() })
      })

      const result = await response.json()
      
      if (result.success) {
        setKbForm({...kbForm, content: result.data.content, source_url: url.trim()})
        showSuccess('URL content scraped successfully')
      } else {
        showError(result.message || 'Failed to scrape URL')
      }
    } catch (error) {
      console.error('Failed to scrape URL:', error)
      showError('Failed to scrape URL. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveKB = async () => {
    if (!adminData?.restUrl || !kbForm.name.trim()) {
      showError('Name is required')
      return
    }

    // Validate content based on source type
    if (kbForm.content_source === 'text' && !kbForm.content.trim()) {
      showError('Content is required')
      return
    }
    
    if (kbForm.content_source === 'url' && !kbForm.source_url.trim()) {
      showError('Please enter a URL to scrape')
      return
    }
    
    if (kbForm.content_source === 'file' && !kbForm.uploaded_file && !kbForm.content.trim()) {
      showError('Please upload a file or the file processing failed')
      return
    }

    try {
      const url = editingKB 
        ? `${adminData.restUrl}knowledge-base/${editingKB.id}`
        : `${adminData.restUrl}knowledge-base`
      
      const response = await fetch(url, {
        method: editingKB ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify(kbForm)
      })

      const result = await response.json()
      
      if (result.success) {
        showSuccess(editingKB ? 'Knowledge base entry updated successfully' : 'Knowledge base entry created successfully')
        setShowKBModal(false)
        resetKBForm()
        loadData()
      } else {
        showError(result.message || 'Failed to save knowledge base entry')
      }
    } catch (error) {
      console.error('Failed to save knowledge base entry:', error)
      showError('Failed to save knowledge base entry. Please try again.')
    }
  }

  const handleDeleteKB = async (kbId) => {
    if (!confirm('Are you sure you want to delete this knowledge base entry?')) {
      return
    }

    try {
      const response = await fetch(`${adminData.restUrl}knowledge-base/${kbId}`, {
        method: 'DELETE',
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })

      const result = await response.json()
      
      if (result.success) {
        showSuccess('Knowledge base entry deleted successfully')
        loadData()
      } else {
        showError(result.message || 'Failed to delete knowledge base entry')
      }
    } catch (error) {
      console.error('Failed to delete knowledge base entry:', error)
      showError('Failed to delete knowledge base entry. Please try again.')
    }
  }

  const renderTabButton = (tabId, label, count = null) => (
    <button
      key={tabId}
      onClick={() => setActiveTab(tabId)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 flex items-center gap-2 ${
        activeTab === tabId
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {label}
      {count !== null && (
        <Badge color={activeTab === tabId ? 'info' : 'gray'} size="sm">
          {count}
        </Badge>
      )}
    </button>
  )

  const renderAgentsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">AI Agents</h2>
          <p className="text-gray-600 dark:text-gray-400">Create and manage AI agents with custom personalities and knowledge.</p>
        </div>
        <Button onClick={handleCreateAgent}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Agent
        </Button>
      </div>

      {/* Agents List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Card key={agent.id} className="relative">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {agent.description || 'No description'}
                  </p>
                </div>
                <Badge color={agent.is_active ? 'success' : 'warning'} size="sm">
                  {agent.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* Agent Details */}
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400 mb-4">
                <div className="flex justify-between">
                  <span>Tonality:</span>
                  <span className="font-medium">{agent.tonality}</span>
                </div>
                <div className="flex justify-between">
                  <span>Response Length:</span>
                  <span className="font-medium">{agent.response_length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Temperature:</span>
                  <span className="font-medium">{agent.temperature}</span>
                </div>
                {agent.knowledge_base_ids && (
                  <div className="flex justify-between">
                    <span>KB Entries:</span>
                    <span className="font-medium">
                      {agent.knowledge_base_ids.split(',').filter(id => id.trim()).length}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  color="gray"
                  onClick={() => handleEditAgent(agent)}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  color="failure"
                  onClick={() => handleDeleteAgent(agent.id)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364-.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No AI agents created yet</p>
          <Button onClick={handleCreateAgent}>Create Your First Agent</Button>
        </div>
      )}
    </div>
  )

  const renderKnowledgeBaseTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Knowledge Base</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage knowledge base entries to provide context to your AI agents.</p>
        </div>
        <Button onClick={handleCreateKB}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Entry
        </Button>
      </div>

      {/* Knowledge Base List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : knowledgeBaseEntries.length > 0 ? (
        <div className="space-y-4">
          {knowledgeBaseEntries.map((kb) => (
            <Card key={kb.id}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {kb.name}
                    </h3>
                    <Badge color={kb.is_active ? 'success' : 'warning'} size="sm">
                      {kb.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {kb.category && (
                      <Badge color="purple" size="sm">
                        {kb.category}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {kb.description || 'No description'}
                  </p>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                    Content: {kb.content ? `${kb.content.substring(0, 100)}...` : 'No content'}
                  </div>
                  
                  {kb.tags && (
                    <div className="flex flex-wrap gap-1">
                      {kb.tags.split(',').map((tag, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button 
                    size="sm" 
                    color="gray"
                    onClick={() => handleEditKB(kb)}
                  >
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    color="failure"
                    onClick={() => handleDeleteKB(kb.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No knowledge base entries created yet</p>
          <Button onClick={handleCreateKB}>Create Your First Entry</Button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-2">
          {renderTabButton('agents', 'AI Agents', agents.length)}
          {renderTabButton('knowledge-base', 'Knowledge Base', knowledgeBaseEntries.length)}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'agents' && renderAgentsTab()}
      {activeTab === 'knowledge-base' && renderKnowledgeBaseTab()}

      {/* Agent Modal */}
      <FormModal 
        isOpen={showAgentModal} 
        onClose={() => setShowAgentModal(false)} 
        title={editingAgent ? 'Edit AI Agent' : 'Create AI Agent'}
        onSave={handleSaveAgent}
        saveText={editingAgent ? 'Update Agent' : 'Create Agent'}
      >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div>
                <Label htmlFor="agent-name">Name *</Label>
                <TextInput
                  id="agent-name"
                  type="text"
                  value={agentForm.name}
                  onChange={(e) => setAgentForm({...agentForm, name: e.target.value})}
                  placeholder="Enter agent name"
                />
              </div>

              <div>
                <Label htmlFor="agent-tonality">Tonality</Label>
                <Select
                  id="agent-tonality"
                  value={agentForm.tonality}
                  onChange={(e) => setAgentForm({...agentForm, tonality: e.target.value})}
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                  <option value="creative">Creative</option>
                  <option value="technical">Technical</option>
                  <option value="persuasive">Persuasive</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="agent-response-length">Response Length</Label>
                <Select
                  id="agent-response-length"
                  value={agentForm.response_length}
                  onChange={(e) => setAgentForm({...agentForm, response_length: e.target.value})}
                >
                  <option value="short">Short (1-2 paragraphs)</option>
                  <option value="medium">Medium (3-5 paragraphs)</option>
                  <option value="long">Long (6+ paragraphs)</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="agent-temperature">Temperature ({agentForm.temperature})</Label>
                <input
                  id="agent-temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={agentForm.temperature}
                  onChange={(e) => setAgentForm({...agentForm, temperature: parseFloat(e.target.value)})}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Lower values = more focused, Higher values = more creative
                </div>
              </div>

              <div>
                <Label htmlFor="agent-max-tokens">Max Tokens</Label>
                <TextInput
                  id="agent-max-tokens"
                  type="number"
                  value={agentForm.max_tokens}
                  onChange={(e) => setAgentForm({...agentForm, max_tokens: parseInt(e.target.value) || 2000})}
                  placeholder="2000"
                />
              </div>

              <div>
                <Label htmlFor="agent-knowledge-base">Knowledge Base Context</Label>
                <SearchableKBDropdown
                  knowledgeBaseEntries={knowledgeBaseEntries}
                  selectedIds={agentForm.knowledge_base_ids}
                  onChange={(selectedIds) => setAgentForm({...agentForm, knowledge_base_ids: selectedIds})}
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Search and select knowledge base entries to provide context to this agent
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="agent-description">Description</Label>
              <Textarea
                id="agent-description"
                rows={3}
                value={agentForm.description}
                onChange={(e) => setAgentForm({...agentForm, description: e.target.value})}
                placeholder="Brief description of this agent's purpose..."
              />
            </div>

            <div>
              <Label htmlFor="agent-system-message">System Message</Label>
              <Textarea
                id="agent-system-message"
                rows={6}
                value={agentForm.system_message}
                onChange={(e) => setAgentForm({...agentForm, system_message: e.target.value})}
                placeholder="You are a helpful AI assistant. Please provide detailed and accurate responses..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="agent-active"
                type="checkbox"
                checked={agentForm.is_active}
                onChange={(e) => setAgentForm({...agentForm, is_active: e.target.checked})}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <Label htmlFor="agent-active">Active</Label>
            </div>
          </div>
      </FormModal>

      {/* Knowledge Base Modal */}
      <FormModal
        isOpen={showKBModal}
        onClose={() => setShowKBModal(false)}
        title={editingKB ? 'Edit Knowledge Base Entry' : 'Create Knowledge Base Entry'}
        onSave={handleSaveKB}
        saveText={editingKB ? 'Update Entry' : 'Create Entry'}
        isSaving={isProcessing}
      >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="kb-name">Name *</Label>
                <TextInput
                  id="kb-name"
                  type="text"
                  value={kbForm.name}
                  onChange={(e) => setKbForm({...kbForm, name: e.target.value})}
                  placeholder="Enter entry name"
                />
              </div>

              <div>
                <Label htmlFor="kb-category">Category</Label>
                <TextInput
                  id="kb-category"
                  type="text"
                  value={kbForm.category}
                  onChange={(e) => setKbForm({...kbForm, category: e.target.value})}
                  placeholder="e.g., Documentation, FAQ, Guidelines"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="kb-description">Description</Label>
              <Textarea
                id="kb-description"
                rows={2}
                value={kbForm.description}
                onChange={(e) => setKbForm({...kbForm, description: e.target.value})}
                placeholder="Brief description of this knowledge base entry..."
              />
            </div>

            {/* Content Source Selection */}
            <div>
              <Label>Content Source *</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="content_source"
                    value="text"
                    checked={kbForm.content_source === 'text'}
                    onChange={(e) => setKbForm({...kbForm, content_source: e.target.value, content: '', source_url: '', uploaded_file: null})}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">Direct Text Input</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="content_source"
                    value="file"
                    checked={kbForm.content_source === 'file'}
                    onChange={(e) => setKbForm({...kbForm, content_source: e.target.value, content: '', source_url: '', uploaded_file: null})}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">File Upload</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="content_source"
                    value="url"
                    checked={kbForm.content_source === 'url'}
                    onChange={(e) => setKbForm({...kbForm, content_source: e.target.value, content: '', source_url: '', uploaded_file: null})}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">URL Scraping</span>
                </label>
              </div>
            </div>

            {/* Content Input Based on Source Type */}
            {kbForm.content_source === 'text' && (
              <div>
                <Label htmlFor="kb-content">Content *</Label>
                <Textarea
                  id="kb-content"
                  rows={12}
                  value={kbForm.content}
                  onChange={(e) => setKbForm({...kbForm, content: e.target.value})}
                  placeholder="Enter the knowledge content that will be provided to AI agents as context..."
                />
              </div>
            )}

            {kbForm.content_source === 'file' && (
              <div>
                <Label htmlFor="kb-file">File Upload *</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    id="kb-file"
                    accept=".pdf,.docx,.doc,.txt,.md,.jpg,.jpeg,.png,.gif,.webp"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) {
                        handleFileUpload(file)
                      }
                    }}
                    className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                    disabled={isProcessing}
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Supported formats: PDF, DOCX, DOC, TXT, MD, JPG, PNG, GIF, WEBP
                  </div>
                </div>
                {isProcessing && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                    <Spinner size="sm" />
                    Processing file...
                  </div>
                )}
                {kbForm.content && (
                  <div className="mt-3">
                    <Label>Extracted Content (Preview)</Label>
                    <Textarea
                      rows={8}
                      value={kbForm.content}
                      onChange={(e) => setKbForm({...kbForm, content: e.target.value})}
                      className="mt-1"
                      placeholder="File content will appear here after processing..."
                    />
                  </div>
                )}
              </div>
            )}

            {kbForm.content_source === 'url' && (
              <div>
                <Label htmlFor="kb-url">Website URL *</Label>
                <div className="flex gap-2 mt-2">
                  <TextInput
                    id="kb-url"
                    type="url"
                    value={kbForm.source_url}
                    onChange={(e) => setKbForm({...kbForm, source_url: e.target.value})}
                    placeholder="https://example.com/page-to-scrape"
                    className="flex-1"
                    disabled={isProcessing}
                  />
                  <Button
                    type="button"
                    onClick={() => handleUrlScraping(kbForm.source_url)}
                    disabled={isProcessing || !kbForm.source_url.trim()}
                    size="sm"
                  >
                    {isProcessing ? <Spinner size="sm" /> : 'Scrape'}
                  </Button>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter a URL to automatically extract and convert the content to plain text
                </div>
                {isProcessing && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                    <Spinner size="sm" />
                    Scraping URL content...
                  </div>
                )}
                {kbForm.content && (
                  <div className="mt-3">
                    <Label>Scraped Content (Preview)</Label>
                    <Textarea
                      rows={8}
                      value={kbForm.content}
                      onChange={(e) => setKbForm({...kbForm, content: e.target.value})}
                      className="mt-1"
                      placeholder="Scraped content will appear here..."
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="kb-tags">Tags</Label>
              <TextInput
                id="kb-tags"
                type="text"
                value={kbForm.tags}
                onChange={(e) => setKbForm({...kbForm, tags: e.target.value})}
                placeholder="tag1, tag2, tag3"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Comma-separated tags for organization
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="kb-active"
                type="checkbox"
                checked={kbForm.is_active}
                onChange={(e) => setKbForm({...kbForm, is_active: e.target.checked})}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <Label htmlFor="kb-active">Active</Label>
            </div>
          </div>
      </FormModal>
    </div>
  )
}

export default AIAgents