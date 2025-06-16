import { useState, useEffect } from 'react'
import { Card } from 'flowbite-react'
import CustomSelect from './CustomSelect'

const Analytics = ({ adminData }) => {
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeRange, setTimeRange] = useState(30) // days

  // Time range options for react-select
  const timeRangeOptions = [
    { value: 7, label: 'Last 7 days' },
    { value: 30, label: 'Last 30 days' },
    { value: 90, label: 'Last 90 days' }
  ]

  // Determine if we're in dark mode by checking the document class
  const isDarkMode = document.documentElement.classList.contains('dark')

  useEffect(() => {
    if (adminData) {
      loadAnalytics()
    }
  }, [adminData, timeRange])

  const loadAnalytics = async () => {
    if (!adminData) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${adminData.restUrl}analytics?days=${timeRange}`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setAnalyticsData(data)
      } else {
        setError('Failed to load analytics data')
      }
    } catch (err) {
      console.error('Failed to load analytics:', err)
      setError('Failed to load analytics data')
    }

    setLoading(false)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount || 0)
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0s'
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-brand-dark dark:text-white">Analytics</h2>
          <div className="text-center py-8">
            <p className="text-red-500 dark:text-red-400">{error}</p>
            <button 
              onClick={loadAnalytics}
              className="mt-4 px-4 py-2 bg-brand-accent text-brand-dark rounded-lg hover:bg-brand-accent/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-brand-dark dark:text-white">Analytics</h2>
            <p className="text-gray-600 dark:text-gray-300">
              AI assistant usage insights for the last {timeRange} days
            </p>
          </div>
                      <div className="mt-4 sm:mt-0">
              <CustomSelect
                options={timeRangeOptions}
                value={timeRangeOptions.find(option => option.value === timeRange)}
                onChange={(option) => setTimeRange(option.value)}
                darkMode={isDarkMode}
              />
            </div>
        </div>

        {/* Main Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Total Conversations</h3>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {formatNumber(analyticsData?.chat_stats?.total_sessions)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-800/30 rounded-full">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              {formatNumber(analyticsData?.chat_stats?.total_messages)} total messages
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">API Requests</h3>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatNumber(analyticsData?.api_stats?.total_requests)}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-800/30 rounded-full">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              {analyticsData?.api_stats?.error_count || 0} errors
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Tokens Used</h3>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {formatNumber(analyticsData?.api_stats?.total_tokens)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-800/30 rounded-full">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
              Avg: {formatNumber(Math.round((analyticsData?.api_stats?.total_tokens || 0) / Math.max(analyticsData?.api_stats?.total_requests || 1, 1)))} per request
            </p>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">Total Cost</h3>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {formatCurrency(analyticsData?.api_stats?.total_cost)}
                </p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-800/30 rounded-full">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
              Avg: {formatCurrency((analyticsData?.api_stats?.total_cost || 0) / Math.max(analyticsData?.api_stats?.total_requests || 1, 1))} per request
            </p>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Metrics */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">Average Response Time</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatDuration(analyticsData?.api_stats?.avg_response_time)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">Success Rate</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {((analyticsData?.api_stats?.total_requests - analyticsData?.api_stats?.error_count) / Math.max(analyticsData?.api_stats?.total_requests, 1) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">Active Sessions</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatNumber(analyticsData?.chat_stats?.active_sessions)}
                </span>
              </div>
            </div>
          </div>

          {/* Usage Breakdown */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Usage Breakdown</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">Messages per Session</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {(analyticsData?.chat_stats?.total_messages / Math.max(analyticsData?.chat_stats?.total_sessions, 1)).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">Tokens per Message</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatNumber(Math.round((analyticsData?.api_stats?.total_tokens || 0) / Math.max(analyticsData?.chat_stats?.total_messages, 1)))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">Cost per Session</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency((analyticsData?.api_stats?.total_cost || 0) / Math.max(analyticsData?.chat_stats?.total_sessions, 1))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {analyticsData?.recent_sessions && analyticsData.recent_sessions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Sessions</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Session
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Messages
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Tokens
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Last Activity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                    {analyticsData.recent_sessions.map((session, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {session.title || 'Untitled Session'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {session.providers_used}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {session.message_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatNumber(session.total_tokens)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatCurrency(session.total_cost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(session.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default Analytics 