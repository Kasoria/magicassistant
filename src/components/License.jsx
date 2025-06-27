import { useState, useEffect } from 'react'
import { Card, Button, TextInput, Label, Alert, Spinner } from 'flowbite-react'
import { useToast } from './Toast'

const License = ({ adminData }) => {
  const [licenseData, setLicenseData] = useState(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  
  const { showSuccess, showError } = useToast()

  useEffect(() => {
    loadLicenseStatus()
  }, [])

  const loadLicenseStatus = async () => {
    if (!adminData) return

    setIsLoading(true)
    try {
      const response = await fetch(`${adminData.restUrl}license`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })

      const result = await response.json()
      
      if (result.success) {
        setLicenseData(result.data)
      } else {
        setErrors({ general: result.message || 'Failed to load license status' })
      }
    } catch (error) {
      console.error('Failed to load license status:', error)
      setErrors({ general: 'Failed to load license status' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleActivate = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    if (!licenseKey.trim()) {
      setErrors({ licenseKey: 'License key is required' })
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch(`${adminData.restUrl}license/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({
          license_key: licenseKey.trim()
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setLicenseData(result.data)
        setLicenseKey('')
        showSuccess('License activated successfully!')
      } else {
        // Handle error response
        let errorMessage = 'Failed to activate license'
        
        // Handle different error response formats
        if (result.message) {
          errorMessage = result.message
        } else if (result.data && typeof result.data === 'string') {
          errorMessage = result.data
        } else if (result.data && result.data.message) {
          errorMessage = result.data.message
        } else if (result.error) {
          errorMessage = result.error
        } else if (result.code && result.code === 'activation_failed' && result.data) {
          // Handle WP_Error format from WordPress REST API
          errorMessage = result.data.message || result.message || errorMessage
        }
        
        console.error('License activation error:', {
          status: response.status,
          statusText: response.statusText,
          result: result
        })
        
        setErrors({ general: errorMessage })
        showError(errorMessage)
      }
    } catch (error) {
      console.error('Failed to activate license:', error)
      setErrors({ general: 'Failed to activate license' })
      showError('Failed to activate license')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to deactivate this license?')) {
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const response = await fetch(`${adminData.restUrl}license/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })

      const result = await response.json()

      if (result.success) {
        setLicenseData({ ...licenseData, is_active: false, activation_id: null, license_key: '' })
        showSuccess('License deactivated successfully!')
      } else {
        // Handle error response
        let errorMessage = 'Failed to deactivate license'
        
        // Handle different error response formats
        if (result.message) {
          errorMessage = result.message
        } else if (result.data && typeof result.data === 'string') {
          errorMessage = result.data
        } else if (result.data && result.data.message) {
          errorMessage = result.data.message
        } else if (result.error) {
          errorMessage = result.error
        } else if (result.code && result.code === 'deactivation_failed' && result.data) {
          // Handle WP_Error format from WordPress REST API
          errorMessage = result.data.message || result.message || errorMessage
        }
        
        setErrors({ general: errorMessage })
        showError(errorMessage)
      }
    } catch (error) {
      console.error('Failed to deactivate license:', error)
      setErrors({ general: 'Failed to deactivate license' })
      showError('Failed to deactivate license')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper function to display the activated date (now pre-formatted by backend)
  const formatActivatedDate = (dateString) => {
    if (!dateString) return 'Unknown'
    
    // The backend now returns pre-formatted dates using the global format setting
    // Just return the formatted string directly
    return dateString
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading license information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-brand-dark dark:text-white mb-2">
            License Management
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Manage your MagicAssistant license activation for this website.
          </p>
        </div>

        {errors.general && (
          <Alert color="failure" className="mb-6">
            <span className="font-medium">Error:</span> {errors.general}
          </Alert>
        )}

        {licenseData?.is_active ? (
          // License is active - show deactivation form
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-green-800 dark:text-green-200">
                    License Active
                  </h3>
                  <p className="text-green-700 dark:text-green-300">
                    Your {licenseData.product_name} license is active on this site.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 text-sm">
                <div>
                  <Label className="text-green-800 dark:text-green-200 font-medium">
                    License Key
                  </Label>
                  <div className="mt-1 font-mono text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 px-3 py-2 rounded border">
                    {licenseData.license_key || '••••••••••••••••'}
                  </div>
                </div>
                {licenseData.tier && (
                  <div>
                    <Label className="text-green-800 dark:text-green-200 font-medium">
                      Plan
                    </Label>
                    <div className="mt-1 text-green-700 dark:text-green-300">
                      {licenseData.tier}
                    </div>
                  </div>
                )}
                {licenseData.activated_at && (
                  <div className="md:col-span-3">
                    <Label className="text-green-800 dark:text-green-200 font-medium">
                      Activated On
                    </Label>
                    <div className="mt-1 text-green-700 dark:text-green-300">
                      {formatActivatedDate(licenseData.activated_at)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
              <Button
                color="failure"
                size="md"
                onClick={handleDeactivate}
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-500 text-white font-medium rounded-lg transition-colors duration-200"
              >
                {isSubmitting ? (
                  <div className="flex items-center">
                    <Spinner size="sm" className="mr-2" />
                    <span>Deactivating...</span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Deactivate License</span>
                  </div>
                )}
              </Button>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Deactivating the license will disable premium features on this site.
              </p>
            </div>
          </div>
        ) : (
          // License is not active - show activation form
          <form onSubmit={handleActivate} className="space-y-6">
            <div>
              <Label htmlFor="license_key" className="mb-2">
                License Key <span className="text-red-500">*</span>
              </Label>
              <TextInput
                id="license_key"
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Enter your license key..."
                className={errors.licenseKey ? 'border-red-500' : ''}
                disabled={isSubmitting}
                required
              />
              {errors.licenseKey && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.licenseKey}
                </p>
              )}
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Enter the license key you received when purchasing MagicAssistant.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Site Information
              </h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div><strong>Site Name:</strong> {licenseData?.site_name || 'Loading...'}</div>
                <div><strong>Site URL:</strong> {licenseData?.site_url || 'Loading...'}</div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !licenseKey.trim()}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Activating License...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Activate License
                </>
              )}
            </Button>
          </form>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-brand-dark dark:text-white mb-4">
          Need Help?
        </h3>
        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">
              Where do I find my license key?
            </h4>
            <p>
              Your license key was sent to your email when you purchased MagicAssistant. 
              You can also find it in your account dashboard on our website.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">
              Can I use my license on multiple sites?
            </h4>
            <p>
              License usage depends on your purchase plan. Check your license terms 
              or contact support for details about multi-site usage.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">
              Having trouble activating?
            </h4>
            <p>
              Make sure your license key is entered correctly and that you haven't 
              exceeded the allowed number of activations. Contact our support team 
              if you continue to experience issues.
            </p>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <a
            href="https://magicplugins.io/support"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-brand-accent hover:text-brand-accent-dark"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Contact Support
          </a>
        </div>
      </Card>
    </div>
  )
}

export default License 