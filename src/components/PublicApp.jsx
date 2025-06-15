import React, { useState, useEffect } from 'react'
import { Button, Card } from 'flowbite-react'

const PublicApp = () => {
  const [theme, setTheme] = useState('light')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Check if WordPress data is available
    if (typeof window.matPublicData !== 'undefined') {
      setIsLoaded(true)
    }
    
    // Initialize theme
    const savedTheme = localStorage.getItem('mat-theme') || 'light'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('mat-theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="mat-public-app min-h-screen bg-brand-light dark:bg-brand-dark">
      <div className="container mx-auto p-4">
        <Card className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-center mb-4">
            MagicAssistant Public
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
            Welcome to MagicAssistant! Your AI-powered WordPress assistant.
          </p>
          <div className="flex justify-center">
            <Button onClick={toggleTheme} color="primary">
              Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default PublicApp 