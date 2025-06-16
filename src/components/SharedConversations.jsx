import { useState, useEffect } from 'react'
import { Button, Card, Spinner } from 'flowbite-react'
import { useToast } from './Toast'
import ConfirmationModal from './ConfirmationModal'

const SharedConversations = ({ adminData }) => {
  const [sharedConversations, setSharedConversations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [conversationToDelete, setConversationToDelete] = useState(null)
  const { showError, showSuccess } = useToast()

  useEffect(() => {
    loadSharedConversations()
  }, [])

  const loadSharedConversations = async () => {
    try {
      const response = await fetch(`${adminData.restUrl}shared-conversations`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSharedConversations(data.conversations || [])
        }
      }
    } catch (error) {
      console.error('Failed to load shared conversations:', error)
      showError('Failed to load shared conversations')
    }
    
    setIsLoading(false)
  }

  const deleteSharedConversation = async (shareId) => {
    try {
      const response = await fetch(`${adminData.restUrl}shared-conversations/${shareId}`, {
        method: 'DELETE',
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSharedConversations(prev => prev.filter(conv => conv.share_id !== shareId))
          showSuccess('Shared conversation deleted successfully')
        } else {
          showError('Failed to delete shared conversation: ' + (data.message || 'Unknown error'))
        }
      } else {
        showError('Failed to delete shared conversation')
      }
    } catch (error) {
      console.error('Failed to delete shared conversation:', error)
      showError('Failed to delete shared conversation')
    }
  }

  const copyShareUrl = async (shareUrl) => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      showSuccess('Share URL copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy URL: ', err)
      showError('Failed to copy URL')
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getExpiryStatus = (expiresAt) => {
    if (!expiresAt) {
      return { text: 'Never expires', className: 'text-green-600 dark:text-green-400' }
    }
    
    const expiryDate = new Date(expiresAt)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
    
    if (daysUntilExpiry <= 0) {
      return { text: 'Expired', className: 'text-red-600 dark:text-red-400' }
    } else if (daysUntilExpiry <= 7) {
      return { text: `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`, className: 'text-orange-600 dark:text-orange-400' }
    } else {
      return { text: `Expires ${formatDate(expiresAt)}`, className: 'text-gray-600 dark:text-gray-400' }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Shared Conversations</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Manage your publicly shared conversation links
          </p>
        </div>
        <Button size="sm" onClick={loadSharedConversations}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>

      {sharedConversations.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">No shared conversations yet</h3>
            <p className="text-sm">
              Create permanent share links from the chat interface to manage them here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {sharedConversations.map((conversation) => {
            const expiryStatus = getExpiryStatus(conversation.expires_at)
            
            return (
              <Card key={conversation.share_id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {conversation.title}
                    </h3>
                    
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {conversation.view_count} views
                      </span>
                      
                      <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" stroke="none" viewBox="0 0 24 24">
                          <path d="M5.673 0a.7.7 0 0 1 .7.7v1.309h7.517v-1.3a.7.7 0 0 1 1.4 0v1.3H18a2 2 0 0 1 2 1.999v13.993A2 2 0 0 1 18 20H2a2 2 0 0 1-2-1.999V4.008a2 2 0 0 1 2-1.999h2.973V.699a.7.7 0 0 1 .7-.699ZM1.4 7.742v10.259a.6.6 0 0 0 .6.6h16a.6.6 0 0 0 .6-.6V7.756L1.4 7.742Zm5.267 6.877v1.666H5v-1.666h1.667Zm4.166 0v1.666H9.167v-1.666h1.666Zm4.167 0v1.666h-1.667v-1.666H15Zm-8.333-3.977v1.666H5v-1.666h1.667Zm4.166 0v1.666H9.167v-1.666h1.666Zm4.167 0v1.666h-1.667v-1.666H15ZM4.973 3.408H2a.6.6 0 0 0-.6.6v2.335l17.2.014V4.008a.6.6 0 0 0-.6-.6h-2.71v.929a.7.7 0 0 1-1.4 0v-.929H6.373v.92a.7.7 0 0 1-1.4 0v-.92Z"/>
                        </svg>
                        Created {formatDate(conversation.created_at)}
                      </span>
                      
                      <span className={`flex items-center ${expiryStatus.className}`}>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {expiryStatus.text}
                      </span>
                    </div>
                    
                    <div className="mt-3">
                      <div className="flex items-center space-x-2">
                        <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-800 dark:text-gray-200 truncate">
                          {conversation.share_url}
                        </code>
                        <Button
                          size="xs"
                          onClick={() => copyShareUrl(conversation.share_url)}
                          className="flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      size="xs"
                      color="gray"
                      onClick={() => window.open(conversation.share_url, '_blank')}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View
                    </Button>
                    
                    <Button
                      size="xs"
                      color="failure"
                      onClick={() => setConversationToDelete(conversation)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!conversationToDelete}
        onClose={() => setConversationToDelete(null)}
        onConfirm={() => {
          if (conversationToDelete) {
            deleteSharedConversation(conversationToDelete.share_id)
            setConversationToDelete(null)
          }
        }}
        title="Delete Shared Conversation"
        message={`Are you sure you want to delete the shared link for "${conversationToDelete?.title}"? This will make the public URL inaccessible. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-900"
        icon="delete"
      />
    </div>
  )
}

export default SharedConversations 