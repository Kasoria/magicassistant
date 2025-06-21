import { useState, useEffect, useRef } from 'react'
import { Button, Card, Badge, Spinner } from 'flowbite-react'
import { useToast } from './Toast'

const SEO = ({ adminData }) => {
  const [seoData, setSeoData] = useState(null)
  const [pagespeedData, setPagespeedData] = useState(null)
  const [siteAnalysisData, setSiteAnalysisData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pagespeedLoading, setPagespeedLoading] = useState(true)
  const [siteAnalysisLoading, setSiteAnalysisLoading] = useState(true)
  const [hasData, setHasData] = useState(false)
  const [hasPagespeedData, setHasPagespeedData] = useState(false)
  const [hasSiteAnalysisData, setHasSiteAnalysisData] = useState(false)
  const [isGeneratingData, setIsGeneratingData] = useState(false)
  const [activeTab, setActiveTab] = useState('seo')
  const { showSuccess, showError } = useToast()
  
  // Chart refs
  const keywordRankingsChartRef = useRef(null)
  const organicTrafficChartRef = useRef(null)
  const competitorChartRef = useRef(null)
  const technicalScoreChartRef = useRef(null)
  
  // Chart instances for cleanup
  const chartInstancesRef = useRef([])

  useEffect(() => {
    loadSEOData()
    loadPagespeedData()
    loadSiteAnalysisData()
    
    // Cleanup function to destroy charts when component unmounts
    return () => {
      chartInstancesRef.current.forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
          try {
            chart.destroy()
          } catch (error) {
            console.warn('Error destroying chart:', error)
          }
        }
      })
      chartInstancesRef.current = []
    }
  }, [])

  const loadSEOData = async () => {
    if (!adminData?.restUrl) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Check if we have any SEO data stored
      const response = await fetch(`${adminData.restUrl}seo-data`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && Object.keys(data.data).length > 0) {
          setSeoData(data.data)
          setHasData(true)
          // Initialize charts after data is loaded
          setTimeout(() => initializeCharts(data.data), 100)
        } else {
          setHasData(false)
        }
      } else {
        setHasData(false)
      }
    } catch (error) {
      console.error('Failed to load SEO data:', error)
      setHasData(false)
    } finally {
      setLoading(false)
    }
  }

  const loadPagespeedData = async () => {
    if (!adminData?.restUrl) {
      setPagespeedLoading(false)
      return
    }

    try {
      setPagespeedLoading(true)
      
      // Check if we have any PageSpeed data stored
      const response = await fetch(`${adminData.restUrl}pagespeed-data`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && Object.keys(data.data).length > 0) {
          setPagespeedData(data.data)
          setHasPagespeedData(true)
        } else {
          setHasPagespeedData(false)
        }
      } else {
        setHasPagespeedData(false)
      }
    } catch (error) {
      console.error('Failed to load PageSpeed data:', error)
      setHasPagespeedData(false)
    } finally {
      setPagespeedLoading(false)
    }
  }

  const loadSiteAnalysisData = async () => {
    if (!adminData?.restUrl) {
      setSiteAnalysisLoading(false)
      return
    }

    try {
      setSiteAnalysisLoading(true)
      
      // Check if we have any Site Analysis data stored
      const response = await fetch(`${adminData.restUrl}site-analysis-data`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && Object.keys(data.data).length > 0) {
          setSiteAnalysisData(data.data)
          setHasSiteAnalysisData(true)
        } else {
          setHasSiteAnalysisData(false)
        }
      } else {
        setHasSiteAnalysisData(false)
      }
    } catch (error) {
      console.error('Failed to load Site Analysis data:', error)
      setHasSiteAnalysisData(false)
    } finally {
      setSiteAnalysisLoading(false)
    }
  }

  const initializeCharts = (data) => {
    // Ensure DOM elements are available before rendering
    const checkRefsAndRender = () => {
      if (keywordRankingsChartRef.current && 
          organicTrafficChartRef.current && 
          competitorChartRef.current && 
          technicalScoreChartRef.current) {
        renderCharts(data)
      } else {
        // Retry after a short delay if refs are not ready
        setTimeout(checkRefsAndRender, 50)
      }
    }

    if (typeof window.ApexCharts === 'undefined') {
      // Load ApexCharts if not available
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/apexcharts@3.46.0/dist/apexcharts.min.js'
      script.onload = () => {
        setTimeout(checkRefsAndRender, 100)
      }
      document.head.appendChild(script)
    } else {
      setTimeout(checkRefsAndRender, 50)
    }
  }

  const renderCharts = (data) => {
    // Clear existing charts first
    chartInstancesRef.current.forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        try {
          chart.destroy()
        } catch (error) {
          console.warn('Error destroying existing chart:', error)
        }
      }
    })
    chartInstancesRef.current = []

    // Keyword Rankings Chart
    if (keywordRankingsChartRef.current && data.keywordRankings && document.documentElement) {
      try {
        const keywordOptions = {
          chart: {
            height: 350,
            type: 'line',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
          },
          series: [{
            name: 'Average Position',
            data: data.keywordRankings.map(item => ({
              x: item.keyword,
              y: item.position
            }))
          }],
          xaxis: {
            type: 'category',
            labels: {
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
              }
            }
          },
          yaxis: {
            reversed: true,
            min: 1,
            max: 100,
            labels: {
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
              }
            }
          },
          stroke: {
            curve: 'smooth',
            width: 3
          },
          colors: ['#3B82F6'],
          grid: {
            borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#E5E7EB'
          },
          theme: {
            mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
          }
        }
        
        const chart = new window.ApexCharts(keywordRankingsChartRef.current, keywordOptions)
        chartInstancesRef.current.push(chart)
        chart.render()
      } catch (error) {
        console.error('Error rendering keyword rankings chart:', error)
      }
    }

    // Organic Traffic Chart
    if (organicTrafficChartRef.current && data.organicTraffic && document.documentElement) {
      try {
        const trafficOptions = {
          chart: {
            height: 350,
            type: 'area',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
          },
          series: [{
            name: 'Organic Traffic',
            data: data.organicTraffic.map(item => ({
              x: item.date,
              y: item.traffic
            }))
          }],
          xaxis: {
            type: 'datetime',
            labels: {
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
              }
            }
          },
          yaxis: {
            labels: {
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
              }
            }
          },
          fill: {
            type: 'gradient',
            gradient: {
              opacityFrom: 0.6,
              opacityTo: 0.1
            }
          },
          stroke: {
            curve: 'smooth',
            width: 2
          },
          colors: ['#10B981'],
          grid: {
            borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#E5E7EB'
          },
          theme: {
            mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
          }
        }
        
        const chart = new window.ApexCharts(organicTrafficChartRef.current, trafficOptions)
        chartInstancesRef.current.push(chart)
        chart.render()
      } catch (error) {
        console.error('Error rendering organic traffic chart:', error)
      }
    }

    // Competitor Analysis Chart
    if (competitorChartRef.current && data.competitors && document.documentElement) {
      try {
        const competitorOptions = {
          chart: {
            height: 350,
            type: 'bar',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
          },
          series: [{
            name: 'Domain Authority',
            data: data.competitors.map(item => ({
              x: item.domain,
              y: item.authority
            }))
          }],
          xaxis: {
            type: 'category',
            labels: {
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
              }
            }
          },
          yaxis: {
            min: 0,
            max: 100,
            labels: {
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
              }
            }
          },
          plotOptions: {
            bar: {
              borderRadius: 4,
              horizontal: false
            }
          },
          colors: ['#8B5CF6'],
          grid: {
            borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#E5E7EB'
          },
          theme: {
            mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
          }
        }
        
        const chart = new window.ApexCharts(competitorChartRef.current, competitorOptions)
        chartInstancesRef.current.push(chart)
        chart.render()
      } catch (error) {
        console.error('Error rendering competitor chart:', error)
      }
    }

    // Technical SEO Score Chart
    if (technicalScoreChartRef.current && data.technicalScores && document.documentElement) {
      try {
        const technicalOptions = {
          chart: {
            height: 350,
            type: 'radialBar',
            fontFamily: 'Inter, sans-serif'
          },
          series: [
            data.technicalScores.performance || 0,
            data.technicalScores.accessibility || 0,
            data.technicalScores.bestPractices || 0,
            data.technicalScores.seo || 0
          ],
          labels: ['Performance', 'Accessibility', 'Best Practices', 'SEO'],
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
          plotOptions: {
            radialBar: {
              dataLabels: {
                name: {
                  fontSize: '16px',
                  color: document.documentElement.classList.contains('dark') ? '#F9FAFB' : '#1F2937'
                },
                value: {
                  fontSize: '14px',
                  color: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
                }
              }
            }
          },
          theme: {
            mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
          }
        }
        
        const chart = new window.ApexCharts(technicalScoreChartRef.current, technicalOptions)
        chartInstancesRef.current.push(chart)
        chart.render()
      } catch (error) {
        console.error('Error rendering technical score chart:', error)
      }
    }
  }

  const generateSEOData = async () => {
    if (!adminData?.restUrl) {
      showError('Unable to connect to WordPress API')
      return
    }

    setIsGeneratingData(true)

    try {
      // Navigate to chat with pre-filled SEO analysis message
      const seoMessage = `Please perform a comprehensive SEO analysis of my website. I need you to:

1. Analyze the SERP for my main keywords
2. Check keyword difficulty and search volume for my target keywords  
3. Perform a domain analysis to understand my site's SEO performance
4. Identify my main competitors and analyze their SEO strategies
5. Run a technical SEO audit to identify any issues

Please use the DataForSEO tools to gather this information and provide me with actionable insights to improve my website's search engine rankings.`

      // Save the message to be used when switching to chat
      sessionStorage.setItem('mat_prefill_message', seoMessage)
      
      // Switch to chat tab
      const url = new URL(window.location)
      url.searchParams.set('tab', 'chat')
      window.history.pushState({}, '', url)
      
      // Trigger a custom event to notify the parent component
      window.dispatchEvent(new CustomEvent('mat_switch_tab', { 
        detail: { tab: 'chat', prefillMessage: seoMessage } 
      }))
      
      showSuccess('Redirecting to AI Assistant with SEO analysis request...')
      
    } catch (error) {
      console.error('Failed to generate SEO data:', error)
      showError('Failed to initiate SEO analysis. Please try again.')
    } finally {
      setIsGeneratingData(false)
    }
  }

  const generateSampleData = async () => {
    if (!adminData?.restUrl) {
      showError('Unable to connect to WordPress API')
      return
    }

    setIsGeneratingData(true)

    try {
      // Generate sample SEO data
      const sampleData = {
        keywordRankings: [
          { keyword: 'wordpress development', position: 8, volume: 2400, difficulty: 65 },
          { keyword: 'web design services', position: 15, volume: 1800, difficulty: 58 },
          { keyword: 'seo optimization', position: 23, volume: 3200, difficulty: 72 },
          { keyword: 'website maintenance', position: 12, volume: 950, difficulty: 45 },
          { keyword: 'custom wordpress themes', position: 35, volume: 1200, difficulty: 68 }
        ],
        organicTraffic: [
          { date: '2024-01-01', traffic: 1250 },
          { date: '2024-01-08', traffic: 1380 },
          { date: '2024-01-15', traffic: 1520 },
          { date: '2024-01-22', traffic: 1680 },
          { date: '2024-01-29', traffic: 1850 }
        ],
        competitors: [
          { domain: 'competitor1.com', authority: 78, keywords: 15420, traffic: 125000 },
          { domain: 'competitor2.com', authority: 65, keywords: 8950, traffic: 85000 },
          { domain: 'competitor3.com', authority: 82, keywords: 22100, traffic: 180000 },
          { domain: 'competitor4.com', authority: 59, keywords: 6800, traffic: 65000 },
          { domain: 'competitor5.com', authority: 71, keywords: 12500, traffic: 95000 }
        ],
        technicalScores: {
          performance: 85,
          accessibility: 92,
          bestPractices: 88,
          seo: 79
        },
        averagePosition: 18.6,
        totalTraffic: 8650,
        totalKeywords: 127,
        seoScore: 86
      }

      // Save sample data to the database
      const response = await fetch(`${adminData.restUrl}seo-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify(sampleData)
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSeoData(sampleData)
          setHasData(true)
          showSuccess('Sample SEO data loaded successfully!')
          // Initialize charts with sample data
          setTimeout(() => initializeCharts(sampleData), 100)
        } else {
          showError('Failed to save sample data')
        }
      } else {
        showError('Failed to save sample data')
      }
    } catch (error) {
      console.error('Failed to generate sample data:', error)
      showError('Failed to generate sample data. Please try again.')
    } finally {
      setIsGeneratingData(false)
    }
  }

  const requestSEOAnalysis = () => {
    setIsGeneratingData(true)
    
    // Create a comprehensive SEO analysis request message
    const seoAnalysisMessage = `Please perform a comprehensive SEO analysis of my website. I need:

1. **Keyword Analysis**: Use dataforseo_keyword_difficulty to analyze my main keywords and find new opportunities
2. **SERP Analysis**: Use dataforseo_serp_analysis to check how my site ranks for important keywords
3. **Competitor Analysis**: Use dataforseo_competitor_analysis to identify my main competitors and their strategies
4. **Technical SEO Audit**: Use dataforseo_technical_audit to check my site's technical health and performance
5. **Domain Analysis**: Use dataforseo_domain_analysis to get overall domain metrics

Please provide actionable insights and recommendations based on the data you find. Focus on:
- Keywords I should target
- Technical issues to fix
- Competitor strategies I can learn from
- Overall SEO score and improvement areas

Start by using the dataforseo_suggest_location tool to get the right location and language settings for my analysis.`

    // Store the message in sessionStorage for the chat interface to pick up
    sessionStorage.setItem('mat_prefill_message', seoAnalysisMessage)
    
    // Dispatch custom event to switch to chat tab
    window.dispatchEvent(new CustomEvent('mat_switch_tab', {
      detail: { tab: 'chat' }
    }))
    
    // Reset the generating state after a short delay
    setTimeout(() => {
      setIsGeneratingData(false)
    }, 1000)
  }

  const requestSiteAnalysis = () => {
    setIsGeneratingData(true)
    
    // Create a comprehensive site analysis request message
    const siteAnalysisMessage = `Please perform a comprehensive SEO audit of my website using the seo_comprehensive_audit function. This will analyze:

1. **Meta title and description analysis** - Check all pages for missing, too short, or too long meta tags
2. **Schema/structured data detector and analysis** - Identify schema markup and opportunities
3. **OpenGraph tags analysis** - Check social media sharing optimization
4. **Sitemap analysis** - Analyze XML sitemap structure and coverage
5. **Canonical URLs analysis** - Check for canonical URL issues and duplicates
6. **Internal linking analysis** - Examine internal link structure (if available)
7. **Indexation analysis** - Check indexable vs non-indexable pages (if available)
8. **Page-specific content analysis** - Including heading structure, alt text on images, and accessibility

Please provide comprehensive insights with:
- Overall SEO scores and breakdown by component
- Detailed analysis of each SEO aspect
- Specific issues found with counts and examples
- Actionable recommendations prioritized by impact
- Performance metrics and completion rates

Use max_pages=25 for a thorough analysis of my most important pages.`

    // Store the message in sessionStorage for the chat interface to pick up
    sessionStorage.setItem('mat_prefill_message', siteAnalysisMessage)
    
    // Dispatch custom event to switch to chat tab
    window.dispatchEvent(new CustomEvent('mat_switch_tab', {
      detail: { tab: 'chat' }
    }))
    
    // Reset the generating state after a short delay
    setTimeout(() => {
      setIsGeneratingData(false)
    }, 1000)
  }

  const requestPagespeedAnalysis = () => {
    setIsGeneratingData(true)
    
    // Create a comprehensive PageSpeed analysis request message
    const pagespeedAnalysisMessage = `Please perform a comprehensive PageSpeed Insights analysis of my website. I need:

1. **Performance Analysis**: Use pagespeed_analyze to check my website's performance on both mobile and desktop
2. **Core Web Vitals**: Get detailed metrics for LCP, FID, CLS, FCP, and INP
3. **Accessibility Score**: Check accessibility compliance and issues
4. **SEO Score**: Analyze SEO-related performance factors
5. **Best Practices**: Review adherence to web development best practices
6. **Performance Opportunities**: Identify specific areas for improvement

Please start by analyzing my homepage (${window.location.origin}) and provide actionable recommendations based on the results. Focus on:
- Critical performance issues
- Core Web Vitals improvements
- Accessibility enhancements
- SEO optimization opportunities

Use both mobile and desktop strategies for a complete analysis.`

    // Store the message in sessionStorage for the chat interface to pick up
    sessionStorage.setItem('mat_prefill_message', pagespeedAnalysisMessage)
    
    // Dispatch custom event to switch to chat tab
    window.dispatchEvent(new CustomEvent('mat_switch_tab', {
      detail: { tab: 'chat' }
    }))
    
    // Reset the generating state after a short delay
    setTimeout(() => {
      setIsGeneratingData(false)
    }, 1000)
  }

  const generateSamplePagespeedData = async () => {
    if (!adminData?.restUrl) {
      showError('Unable to connect to WordPress API')
      return
    }

    setIsGeneratingData(true)

    try {
      // Generate sample PageSpeed data
      const sampleData = {
        url: window.location.origin,
        strategy: 'mobile',
        scores: {
          performance: { score: 78, title: 'Performance' },
          accessibility: { score: 95, title: 'Accessibility' },
          'best-practices': { score: 88, title: 'Best Practices' },
          seo: { score: 92, title: 'SEO' }
        },
        coreWebVitals: {
          LCP: { value: 2.1, displayValue: '2.1 s', score: 0.85 },
          FID: { value: 95, displayValue: '95 ms', score: 0.90 },
          CLS: { value: 0.08, displayValue: '0.08', score: 0.92 },
          FCP: { value: 1.2, displayValue: '1.2 s', score: 0.95 },
          INP: { value: 180, displayValue: '180 ms', score: 0.88 }
        },
        opportunities: [
          { 
            id: 'largest-contentful-paint', 
            title: 'Reduce initial server response time', 
            description: 'Server response time is slow. Consider upgrading hosting or optimizing server performance.',
            score: 0.6,
            displayValue: 'Potential savings of 1.2 s'
          },
          { 
            id: 'unused-css-rules', 
            title: 'Remove unused CSS', 
            description: 'Remove dead rules from stylesheets to reduce file size.',
            score: 0.7,
            displayValue: 'Potential savings of 45 KiB'
          },
          { 
            id: 'offscreen-images', 
            title: 'Defer offscreen images', 
            description: 'Consider lazy-loading offscreen images to improve page load speed.',
            score: 0.8,
            displayValue: 'Potential savings of 650 ms'
          }
        ]
      }

      // Save sample data to the database
      const response = await fetch(`${adminData.restUrl}pagespeed-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify(sampleData)
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setPagespeedData(sampleData)
          setHasPagespeedData(true)
          showSuccess('Sample PageSpeed data loaded successfully!')
        } else {
          showError('Failed to save sample PageSpeed data')
        }
      } else {
        showError('Failed to save sample PageSpeed data')
      }
    } catch (error) {
      console.error('Failed to generate sample PageSpeed data:', error)
      showError('Failed to generate sample PageSpeed data. Please try again.')
    } finally {
      setIsGeneratingData(false)
    }
  }

  const generateSampleSiteAnalysisData = async () => {
    if (!adminData?.restUrl) {
      showError('Unable to connect to WordPress API')
      return
    }

    setIsGeneratingData(true)

    try {
      // Generate comprehensive sample site analysis data
      const sampleData = {
        meta_analysis: {
          total_pages: 25,
          pages_analyzed: 25,
          meta_summary: {
            missing_titles: 2,
            missing_descriptions: 5,
            title_issues: 8,
            description_issues: 12,
            title_completion_rate: 92,
            description_completion_rate: 80
          },
          pages: [
            {
              url: window.location.origin + '/',
              title: { content: 'Home - Your Website', length: 20, issues: ['Title too short (recommended: 30-60 characters)'] },
              meta_description: { content: 'Welcome to our website featuring amazing content and services.', length: 62, issues: ['Meta description too short (recommended: 120-160 characters)'] },
              post_title: 'Home'
            },
            {
              url: window.location.origin + '/about',
              title: { content: 'About Us - Learn More About Our Company and Mission Statement', length: 59, issues: [] },
              meta_description: { content: 'Discover our story, mission, and the dedicated team behind our success. Learn how we started and where we\'re headed in the future.', length: 131, issues: [] },
              post_title: 'About'
            },
            {
              url: window.location.origin + '/contact',
              title: { content: null, length: 0, issues: ['Missing title tag'] },
              meta_description: { content: null, length: 0, issues: ['Missing meta description'] },
              post_title: 'Contact'
            }
          ]
        },
        structured_data: {
          total_pages: 25,
          pages_with_schema: 18,
          schema_adoption_rate: 72,
          most_common_schemas: {
            'Organization': 12,
            'WebSite': 8,
            'Article': 15,
            'BreadcrumbList': 10,
            'Person': 3
          },
          pages: [
            {
              url: window.location.origin + '/',
              structured_data_count: 3,
              has_organization: true,
              has_website: true,
              has_breadcrumbs: false,
              has_article: false,
              structured_data: [
                { type: 'JSON-LD', schema_type: 'Organization' },
                { type: 'JSON-LD', schema_type: 'WebSite' },
                { type: 'Microdata', schema_type: 'WebPage' }
              ]
            }
          ]
        },
        opengraph: {
          total_pages: 25,
          complete_opengraph: 15,
          has_twitter_cards: 12,
          opengraph_completion_rate: 60,
          twitter_adoption_rate: 48,
          most_common_issues: {
            'Missing og:image': 8,
            'Missing og:description': 5,
            'Missing og:type': 3
          },
          pages: [
            {
              url: window.location.origin + '/',
              opengraph_complete: true,
              opengraph_tags: {
                'og:title': 'Home - Your Website',
                'og:description': 'Welcome to our website',
                'og:image': window.location.origin + '/wp-content/uploads/logo.jpg',
                'og:url': window.location.origin + '/',
                'og:type': 'website'
              },
              twitter_tags: {
                'twitter:card': 'summary_large_image',
                'twitter:title': 'Home - Your Website'
              },
              issues: []
            }
          ]
        },
        sitemap: {
          success: true,
          sitemap_url: window.location.origin + '/wp-sitemap.xml',
          is_index: true,
          url_count: 127,
          sitemap_count: 4,
          analysis: {
            total_urls: 127,
            urls_with_lastmod: 98,
            urls_with_priority: 45,
            changefreq_usage: {
              'weekly': 45,
              'monthly': 32,
              'daily': 15
            }
          }
        },
        canonical_urls: {
          total_pages: 25,
          pages_with_canonical: 23,
          canonical_coverage: 92,
          canonical_issues: {
            'missing_canonical': 2,
            'canonical_mismatch': 1
          },
          pages: [
            {
              url: window.location.origin + '/',
              canonical: window.location.origin + '/',
              issues: []
            },
            {
              url: window.location.origin + '/about',
              canonical: null,
              issues: ['Missing canonical URL']
            }
          ]
        },
        summary: {
          overall_score: 78,
          meta_score: 85,
          structured_data_score: 72,
          opengraph_score: 60,
          sitemap_score: 95,
          canonical_score: 92,
          recommendations: [
            'Add missing meta descriptions to 5 pages',
            'Implement schema markup on 7 additional pages',
            'Add OpenGraph images to 8 pages missing og:image',
            'Fix 2 pages with missing canonical URLs',
            'Optimize title tag lengths on 8 pages'
          ]
        }
      }

      // Save sample data to the database
      const response = await fetch(`${adminData.restUrl}site-analysis-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify(sampleData)
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSiteAnalysisData(sampleData)
          setHasSiteAnalysisData(true)
          showSuccess('Sample Site Analysis data loaded successfully!')
        } else {
          showError('Failed to save sample Site Analysis data')
        }
      } else {
        showError('Failed to save sample Site Analysis data')
      }
    } catch (error) {
      console.error('Failed to generate sample Site Analysis data:', error)
      showError('Failed to generate sample Site Analysis data. Please try again.')
    } finally {
      setIsGeneratingData(false)
    }
  }

  const EmptyState = () => (
    <div className="max-w-md mx-auto text-center py-12">
      <div className="mb-8">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
          <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H9z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No SEO Data Available
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Get comprehensive SEO insights for your website using our AI-powered analysis tools.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">🎯 Real SEO Analysis</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Let our AI analyze your website's SEO performance, keyword rankings, competitors, and technical health.
          </p>
          <Button
            onClick={requestSEOAnalysis}
            disabled={isGeneratingData}
            className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
          >
            {isGeneratingData ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start SEO Analysis
              </>
            )}
          </Button>
        </div>

        <div className="text-gray-500 dark:text-gray-400 text-sm font-medium">OR</div>

        <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">📊 View Sample Data</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Explore the SEO analytics interface with sample data to see what insights you'll get.
          </p>
          <Button
            onClick={generateSampleData}
            disabled={isGeneratingData}
            color="gray"
            className="w-full"
          >
            {isGeneratingData ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Loading Sample Data...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Load Sample Data
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          💡 <strong>Tip:</strong> Real analysis provides actionable insights specific to your website, while sample data helps you understand the interface.
        </p>
      </div>
    </div>
  )

  const DataView = () => (
    <div className="space-y-6">
      {/* SEO Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Avg. Position</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {seoData?.averagePosition || 'N/A'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Organic Traffic</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {seoData?.totalTraffic || 'N/A'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Keywords</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {seoData?.totalKeywords || 'N/A'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">SEO Score</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {seoData?.seoScore || 'N/A'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Keyword Rankings
          </h3>
          <div ref={keywordRankingsChartRef}></div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Organic Traffic Trend
          </h3>
          <div ref={organicTrafficChartRef}></div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Competitor Analysis
          </h3>
          <div ref={competitorChartRef}></div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Technical SEO Scores
          </h3>
          <div ref={technicalScoreChartRef}></div>
        </Card>
      </div>

      {/* Data Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Keywords
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Keyword</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Volume</th>
                  <th className="px-4 py-3">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {seoData?.keywordRankings?.slice(0, 5).map((keyword, index) => (
                  <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {keyword.keyword}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={keyword.position <= 10 ? 'success' : keyword.position <= 30 ? 'warning' : 'failure'}>
                        #{keyword.position}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{keyword.volume || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <Badge color={keyword.difficulty <= 30 ? 'success' : keyword.difficulty <= 60 ? 'warning' : 'failure'}>
                        {keyword.difficulty || 'N/A'}%
                      </Badge>
                    </td>
                  </tr>
                )) || (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No keyword data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Competitors
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Authority</th>
                  <th className="px-4 py-3">Keywords</th>
                  <th className="px-4 py-3">Traffic</th>
                </tr>
              </thead>
              <tbody>
                {seoData?.competitors?.slice(0, 5).map((competitor, index) => (
                  <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {competitor.domain}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={competitor.authority >= 70 ? 'success' : competitor.authority >= 40 ? 'warning' : 'failure'}>
                        {competitor.authority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{competitor.keywords || 'N/A'}</td>
                    <td className="px-4 py-3">{competitor.traffic || 'N/A'}</td>
                  </tr>
                )) || (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No competitor data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Need Fresh SEO Insights?
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Get the latest SEO analysis and recommendations from your AI assistant.
            </p>
          </div>
          <Button 
            onClick={generateSEOData}
            disabled={isGeneratingData}
            className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
          >
            {isGeneratingData ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Updating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Update SEO Analysis
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )

  const SiteAnalysisEmptyState = () => (
    <div className="max-w-md mx-auto text-center py-12">
      <div className="mb-8">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900 mb-4">
          <svg className="h-8 w-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Site Analysis Data Available
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Get comprehensive on-page SEO insights for your website including meta tags, structured data, and content analysis.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">🔍 Real Site Analysis</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Let our AI analyze your website's meta tags, structured data, OpenGraph tags, sitemaps, canonical URLs, and content structure.
          </p>
          <Button
            onClick={requestSiteAnalysis}
            disabled={isGeneratingData}
            className="w-full bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
          >
            {isGeneratingData ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Start Site Analysis
              </>
            )}
          </Button>
        </div>

        <div className="text-gray-500 dark:text-gray-400 text-sm font-medium">OR</div>

        <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">📊 View Sample Data</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Explore the site analysis interface with sample data to see what insights you'll get.
          </p>
          <Button
            onClick={generateSampleSiteAnalysisData}
            disabled={isGeneratingData}
            color="gray"
            className="w-full"
          >
            {isGeneratingData ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Loading Sample Data...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Load Sample Data
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          💡 <strong>Tip:</strong> Site analysis examines your website's technical SEO elements to identify optimization opportunities for better search engine visibility.
        </p>
      </div>
    </div>
  )

  const PagespeedEmptyState = () => (
    <div className="max-w-md mx-auto text-center py-12">
      <div className="mb-8">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
          <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No PageSpeed Data Available
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Get comprehensive performance insights for your website using Google PageSpeed Insights.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">⚡ Real Performance Analysis</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Let our AI analyze your website's performance, Core Web Vitals, accessibility, and SEO scores using Google PageSpeed Insights.
          </p>
          <Button
            onClick={requestPagespeedAnalysis}
            disabled={isGeneratingData}
            className="w-full bg-green-600 hover:bg-green-700 focus:ring-green-500"
          >
            {isGeneratingData ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start PageSpeed Analysis
              </>
            )}
          </Button>
        </div>

        <div className="text-gray-500 dark:text-gray-400 text-sm font-medium">OR</div>

        <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">📊 View Sample Data</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Explore the PageSpeed analytics interface with sample data to see what insights you'll get.
          </p>
          <Button
            onClick={generateSamplePagespeedData}
            disabled={isGeneratingData}
            color="gray"
            className="w-full"
          >
            {isGeneratingData ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Loading Sample Data...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Load Sample Data
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          💡 <strong>Tip:</strong> Real analysis provides actionable insights specific to your website, while sample data helps you understand the interface.
        </p>
      </div>
    </div>
  )

  const PagespeedDataView = () => (
    <div className="space-y-6">
      {/* PageSpeed Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {pagespeedData?.scores && Object.entries(pagespeedData.scores).map(([category, scoreData]) => (
          <Card key={category}>
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${
                scoreData.score >= 90 ? 'bg-green-100 dark:bg-green-900/30' :
                scoreData.score >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                'bg-red-100 dark:bg-red-900/30'
              }`}>
                <svg className={`w-6 h-6 ${
                  scoreData.score >= 90 ? 'text-green-600 dark:text-green-400' :
                  scoreData.score >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{scoreData.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {scoreData.score}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Core Web Vitals */}
      {pagespeedData?.coreWebVitals && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Core Web Vitals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Object.entries(pagespeedData.coreWebVitals).map(([metric, data]) => (
              <div key={metric} className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">{metric}</h4>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {data.displayValue}
                </p>
                {data.score !== null && (
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    data.score >= 0.9 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    data.score >= 0.5 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {Math.round(data.score * 100)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Performance Opportunities */}
      {pagespeedData?.opportunities && pagespeedData.opportunities.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Performance Opportunities
          </h3>
          <div className="space-y-4">
            {pagespeedData.opportunities.map((opportunity, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                      {opportunity.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {opportunity.description}
                    </p>
                    {opportunity.displayValue && (
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {opportunity.displayValue}
                      </p>
                    )}
                  </div>
                  {opportunity.score !== null && (
                    <div className={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      opportunity.score >= 0.9 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      opportunity.score >= 0.5 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {Math.round(opportunity.score * 100)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Need Fresh Performance Insights?
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Get the latest PageSpeed analysis and performance recommendations from your AI assistant.
            </p>
          </div>
          <Button 
            onClick={requestPagespeedAnalysis}
            disabled={isGeneratingData}
            className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
          >
            {isGeneratingData ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Updating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Update PageSpeed Analysis
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )

  const SiteAnalysisDataView = () => {
    // Get scores with proper fallbacks
    const getScoreColor = (score) => {
      if (score >= 80) return 'text-green-600 dark:text-green-400'
      if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
      return 'text-red-600 dark:text-red-400'
    }
    
    const getScoreBgColor = (score) => {
      if (score >= 80) return 'bg-green-100 dark:bg-green-900/30'
      if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30'
      return 'bg-red-100 dark:bg-red-900/30'
    }

    const metaScore = Math.round(siteAnalysisData?.summary?.meta_score || 0)
    const schemaScore = Math.round(siteAnalysisData?.summary?.structured_data_score || 0)
    const openGraphScore = Math.round(siteAnalysisData?.summary?.opengraph_score || 0)
    const overallScore = Math.round(siteAnalysisData?.summary?.overall_score || 0)

    return (
      <div className="space-y-6">
        {/* Site Analysis Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${getScoreBgColor(metaScore)}`}>
                <svg className={`w-6 h-6 ${getScoreColor(metaScore)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Meta Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(metaScore)}`}>
                  {metaScore}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${getScoreBgColor(schemaScore)}`}>
                <svg className={`w-6 h-6 ${getScoreColor(schemaScore)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Schema Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(schemaScore)}`}>
                  {schemaScore}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${getScoreBgColor(openGraphScore)}`}>
                <svg className={`w-6 h-6 ${getScoreColor(openGraphScore)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">OpenGraph Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(openGraphScore)}`}>
                  {openGraphScore}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${getScoreBgColor(overallScore)}`}>
                <svg className={`w-6 h-6 ${getScoreColor(overallScore)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Overall Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
                  {overallScore}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Critical Issues Alert */}
        {(schemaScore === 0 || openGraphScore === 0 || metaScore < 60 || overallScore < 60) && (
          <Card>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                    Critical SEO Issues Found
                  </h3>
                  <div className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    {schemaScore === 0 && <p>• No structured data/schema markup found on any pages - this seriously hurts search visibility</p>}
                    {openGraphScore === 0 && <p>• Missing OpenGraph tags prevent proper social media sharing</p>}
                    {siteAnalysisData?.meta_analysis?.meta_summary?.missing_descriptions >= 20 && 
                      <p>• {siteAnalysisData.meta_analysis.meta_summary.missing_descriptions} pages missing meta descriptions - major SEO issue</p>}
                    {metaScore < 60 && <p>• Meta tags need significant improvement for better search rankings</p>}
                    {overallScore < 60 && <p>• Overall SEO health is below recommended levels</p>}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Recommendations */}
        {siteAnalysisData?.summary?.recommendations && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Priority Recommendations
            </h3>
            <div className="space-y-3">
              {siteAnalysisData.summary.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">{recommendation}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

      {/* Meta Analysis Summary */}
      {siteAnalysisData?.meta_analysis && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Meta Tags Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className={`text-2xl font-bold mb-1 ${
                siteAnalysisData.meta_analysis.meta_summary.title_completion_rate >= 90 ? 'text-green-600 dark:text-green-400' :
                siteAnalysisData.meta_analysis.meta_summary.title_completion_rate >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {siteAnalysisData.meta_analysis.meta_summary.title_completion_rate}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Title Completion</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className={`text-2xl font-bold mb-1 ${
                siteAnalysisData.meta_analysis.meta_summary.description_completion_rate >= 90 ? 'text-green-600 dark:text-green-400' :
                siteAnalysisData.meta_analysis.meta_summary.description_completion_rate >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {siteAnalysisData.meta_analysis.meta_summary.description_completion_rate}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Description Completion</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className={`text-2xl font-bold mb-1 ${
                siteAnalysisData.meta_analysis.meta_summary.missing_titles === 0 ? 'text-green-600 dark:text-green-400' :
                siteAnalysisData.meta_analysis.meta_summary.missing_titles <= 3 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {siteAnalysisData.meta_analysis.meta_summary.missing_titles}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Missing Titles</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className={`text-2xl font-bold mb-1 ${
                siteAnalysisData.meta_analysis.meta_summary.missing_descriptions === 0 ? 'text-green-600 dark:text-green-400' :
                siteAnalysisData.meta_analysis.meta_summary.missing_descriptions <= 3 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {siteAnalysisData.meta_analysis.meta_summary.missing_descriptions}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Missing Descriptions</p>
            </div>
          </div>

          {/* Critical Meta Issues Alert */}
          {(siteAnalysisData.meta_analysis.meta_summary.missing_descriptions >= 10 || 
            siteAnalysisData.meta_analysis.meta_summary.description_completion_rate <= 50) && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                    Critical Meta Tag Issues
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    You have {siteAnalysisData.meta_analysis.meta_summary.missing_descriptions} pages without meta descriptions. 
                    This significantly hurts your search engine visibility and click-through rates. Meta descriptions should be added immediately.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Sample Pages with Issues */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Page</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Meta Description</th>
                  <th className="px-4 py-3">Issues</th>
                </tr>
              </thead>
              <tbody>
                {siteAnalysisData.meta_analysis.pages.slice(0, 10).map((page, index) => {
                  const titleLength = page.title?.length || 0;
                  const metaDescLength = page.meta_description?.length || 0;
                  
                  // Calculate issues: missing content, too short/long content, etc.
                  let issues = [];
                  if (titleLength === 0) issues.push('Missing title');
                  if (metaDescLength === 0) issues.push('Missing description');
                  if (titleLength > 0 && titleLength < 30) issues.push('Title too short');
                  if (titleLength > 60) issues.push('Title too long');
                  if (metaDescLength > 0 && metaDescLength < 120) issues.push('Description too short');
                  if (metaDescLength > 160) issues.push('Description too long');
                  
                  const totalIssues = issues.length;
                  
                  return (
                    <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {page.post_title || 'Unknown'}
                      </td>
                      <td className="px-4 py-3">
                        <a href={page.url} target="_blank" rel="noopener noreferrer" 
                           className="text-blue-600 dark:text-blue-400 hover:underline text-xs">
                          {page.url ? page.url.replace(/^https?:\/\/[^\/]+/, '') : 'N/A'}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        {page.title?.content ? (
                          <div>
                            <span className={`text-xs ${
                              titleLength < 30 ? 'text-red-600 dark:text-red-400' :
                              titleLength > 60 ? 'text-orange-600 dark:text-orange-400' :
                              'text-green-600 dark:text-green-400'
                            }`}>
                              {titleLength} chars
                            </span>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-xs truncate">
                              {page.title.content}
                            </div>
                          </div>
                        ) : (
                          <Badge color="failure">Missing</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {page.meta_description?.content ? (
                          <div>
                            <span className={`text-xs ${
                              metaDescLength < 120 ? 'text-red-600 dark:text-red-400' :
                              metaDescLength > 160 ? 'text-orange-600 dark:text-orange-400' :
                              'text-green-600 dark:text-green-400'
                            }`}>
                              {metaDescLength} chars
                            </span>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-xs truncate">
                              {page.meta_description.content}
                            </div>
                          </div>
                        ) : (
                          <Badge color="failure">Missing</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {totalIssues > 0 ? (
                          <div className="space-y-1">
                            <Badge color="warning">{totalIssues} issues</Badge>
                            {issues.length > 0 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {issues.slice(0, 2).join(', ')}
                                {issues.length > 2 && '...'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge color="success">Good</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Structured Data Analysis */}
      {siteAnalysisData?.structured_data && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Structured Data Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className={`text-2xl font-bold mb-1 ${
                siteAnalysisData.structured_data.schema_adoption_rate >= 80 ? 'text-green-600 dark:text-green-400' :
                siteAnalysisData.structured_data.schema_adoption_rate >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {siteAnalysisData.structured_data.schema_adoption_rate}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Schema Adoption</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className={`text-2xl font-bold mb-1 ${
                siteAnalysisData.structured_data.pages_with_schema > 15 ? 'text-green-600 dark:text-green-400' :
                siteAnalysisData.structured_data.pages_with_schema > 5 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {siteAnalysisData.structured_data.pages_with_schema}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pages with Schema</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className={`text-2xl font-bold mb-1 ${
                Object.keys(siteAnalysisData.structured_data.most_common_schemas || {}).length >= 3 ? 'text-green-600 dark:text-green-400' :
                Object.keys(siteAnalysisData.structured_data.most_common_schemas || {}).length >= 1 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {Object.keys(siteAnalysisData.structured_data.most_common_schemas || {}).length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Schema Types</p>
            </div>
          </div>

          {/* Critical Schema Issues Alert */}
          {siteAnalysisData.structured_data.schema_adoption_rate === 0 && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                    No Structured Data Found
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Your website has no structured data/schema markup. This seriously hurts search engine understanding of your content and can reduce rich snippet opportunities. Consider implementing schema markup for articles, organization, and local business data.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {Object.keys(siteAnalysisData.structured_data.most_common_schemas || {}).length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white">Most Common Schema Types:</h4>
              {Object.entries(siteAnalysisData.structured_data.most_common_schemas || {}).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center py-1">
                  <span className="text-gray-600 dark:text-gray-400">{type}</span>
                  <Badge color="info">{count} pages</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Pages Without Schema Markup:</h4>
              <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Page</th>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">Content Type</th>
                    <th className="px-4 py-3">Recommended Schema</th>
                  </tr>
                </thead>
                <tbody>
                  {siteAnalysisData.structured_data.pages?.slice(0, 5).map((page, index) => (
                    <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {page.post_title || 'Unknown'}
                      </td>
                      <td className="px-4 py-3">
                        <a href={page.url} target="_blank" rel="noopener noreferrer" 
                           className="text-blue-600 dark:text-blue-400 hover:underline text-xs">
                          {page.url ? page.url.replace(/^https?:\/\/[^\/]+/, '') : 'N/A'}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color="gray">Article/Page</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs space-y-1">
                          <Badge color="warning" size="sm">Article</Badge>
                          <Badge color="warning" size="sm">BreadcrumbList</Badge>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* OpenGraph Analysis */}
      {siteAnalysisData?.opengraph && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            OpenGraph Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className={`text-2xl font-bold mb-1 ${
                siteAnalysisData.opengraph.opengraph_completion_rate >= 80 ? 'text-green-600 dark:text-green-400' :
                siteAnalysisData.opengraph.opengraph_completion_rate >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {siteAnalysisData.opengraph.opengraph_completion_rate}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">OpenGraph Complete</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className={`text-2xl font-bold mb-1 ${
                siteAnalysisData.opengraph.twitter_adoption_rate >= 80 ? 'text-green-600 dark:text-green-400' :
                siteAnalysisData.opengraph.twitter_adoption_rate >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {siteAnalysisData.opengraph.twitter_adoption_rate}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Twitter Cards</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className={`text-2xl font-bold mb-1 ${
                siteAnalysisData.opengraph.complete_opengraph >= 15 ? 'text-green-600 dark:text-green-400' :
                siteAnalysisData.opengraph.complete_opengraph >= 5 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {siteAnalysisData.opengraph.complete_opengraph}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Complete Pages</p>
            </div>
          </div>

          {/* Critical OpenGraph Issues Alert */}
          {siteAnalysisData.opengraph.opengraph_completion_rate === 0 && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                    Missing OpenGraph Tags
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Your pages are missing essential OpenGraph tags. This means your content won't display properly when shared on social media platforms like Facebook, LinkedIn, and Twitter. Add og:title, og:description, og:image, and og:url tags.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {Object.keys(siteAnalysisData.opengraph.most_common_issues || {}).length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white">Most Common Issues:</h4>
              {Object.entries(siteAnalysisData.opengraph.most_common_issues || {}).map(([issue, count]) => (
                <div key={issue} className="flex justify-between items-center py-1">
                  <span className="text-gray-600 dark:text-gray-400">{issue}</span>
                  <Badge color="warning">{count} pages</Badge>
                </div>
              ))}
            </div>
          ) : siteAnalysisData.opengraph.pages && (
            <div className="overflow-x-auto">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">OpenGraph Status by Page:</h4>
              <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Page</th>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">OG Tags Found</th>
                    <th className="px-4 py-3">Twitter Cards</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {siteAnalysisData.opengraph.pages?.slice(0, 5).map((page, index) => {
                    const ogTagsCount = Object.keys(page.opengraph_tags || {}).length;
                    const twitterTagsCount = Object.keys(page.twitter_tags || {}).length;
                    const isComplete = page.opengraph_complete;

                    return (
                      <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {page.post_title || 'Unknown'}
                        </td>
                        <td className="px-4 py-3">
                          <a href={page.url} target="_blank" rel="noopener noreferrer" 
                             className="text-blue-600 dark:text-blue-400 hover:underline text-xs">
                            {page.url ? page.url.replace(/^https?:\/\/[^\/]+/, '') : 'N/A'}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          {ogTagsCount > 0 ? (
                            <div className="space-y-1">
                              <span className="text-xs text-gray-600 dark:text-gray-400">{ogTagsCount} tags</span>
                              <div className="flex flex-wrap gap-1">
                                {Object.keys(page.opengraph_tags || {}).slice(0, 3).map(tag => (
                                  <Badge key={tag} color="info" size="sm">{tag.replace('og:', '')}</Badge>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <Badge color="failure" size="sm">None</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {twitterTagsCount > 0 ? (
                            <Badge color="info" size="sm">{twitterTagsCount} tags</Badge>
                          ) : (
                            <Badge color="failure" size="sm">None</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isComplete ? (
                            <Badge color="success">Complete</Badge>
                          ) : ogTagsCount > 0 ? (
                            <Badge color="warning">Partial</Badge>
                          ) : (
                            <Badge color="failure">Missing</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Comprehensive Analysis Notice */}
      {siteAnalysisData?.meta_analysis && !siteAnalysisData?.structured_data && (
        <Card>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Basic Analysis Complete
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  You're currently viewing basic meta tag analysis. For a complete SEO audit including structured data, OpenGraph, sitemap, canonical URLs, and more insights, run a comprehensive analysis.
                </p>
                <Button 
                  onClick={requestSiteAnalysis}
                  disabled={isGeneratingData}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                >
                  {isGeneratingData ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Running...
                    </>
                  ) : (
                    'Run Comprehensive Analysis'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Canonical URLs Analysis */}
      {siteAnalysisData?.canonical_urls && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Canonical URLs Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.canonical_urls.canonical_coverage || 0}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Canonical Coverage</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.canonical_urls.canonical_issues?.missing_canonical || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Missing Canonical</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.canonical_urls.canonical_issues?.self_referencing || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Self-Referencing</p>
            </div>
          </div>
          
          {siteAnalysisData.canonical_urls.canonical_issues && Object.keys(siteAnalysisData.canonical_urls.canonical_issues).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white">Issues Found:</h4>
              {Object.entries(siteAnalysisData.canonical_urls.canonical_issues).map(([issue, count]) => (
                <div key={issue} className="flex justify-between items-center py-1">
                  <span className="text-gray-600 dark:text-gray-400">{issue.replace('_', ' ')}</span>
                  <Badge color="warning">{count} pages</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Internal Linking Analysis */}
      {siteAnalysisData?.internal_links && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Internal Linking Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.internal_links.total_internal_links || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Internal Links</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.internal_links.avg_links_per_page || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Links/Page</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.internal_links.orphaned_pages || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Orphaned Pages</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.internal_links.broken_links || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Broken Links</p>
            </div>
          </div>
        </Card>
      )}

      {/* Indexation Analysis - Only show if we have indexation data */}
      {siteAnalysisData?.indexation && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Indexation Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.indexation.indexable_pages || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Indexable Pages</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.indexation.noindex_pages || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">NoIndex Pages</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.indexation.robots_blocked || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Robots Blocked</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.indexation.sitemap_submitted || 'No'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Sitemap Status</p>
            </div>
          </div>
        </Card>
      )}

      {/* Page Content Analysis */}
      {siteAnalysisData?.content_analysis && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Page Content Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.content_analysis.heading_structure_score || 0}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Heading Structure</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.content_analysis.images_with_alt || 0}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Images with Alt</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.content_analysis.accessibility_score || 0}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Accessibility Score</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.content_analysis.content_length_avg || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Content Length</p>
            </div>
          </div>
          
          {/* Content Issues */}
          {siteAnalysisData.content_analysis.common_issues && Object.keys(siteAnalysisData.content_analysis.common_issues).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white">Common Content Issues:</h4>
              {Object.entries(siteAnalysisData.content_analysis.common_issues).map(([issue, count]) => (
                <div key={issue} className="flex justify-between items-center py-1">
                  <span className="text-gray-600 dark:text-gray-400">{issue}</span>
                  <Badge color="warning">{count} pages</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Sitemap Analysis */}
      {siteAnalysisData?.sitemap && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Sitemap Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.sitemap.url_count || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total URLs</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.sitemap.analysis?.urls_with_lastmod || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">With LastMod</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.sitemap.analysis?.urls_with_priority || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">With Priority</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {siteAnalysisData.sitemap.is_index ? 'Index' : 'Regular'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Sitemap Type</p>
            </div>
          </div>
        </Card>
      )}

      {/* Comprehensive Analysis Summary */}
      {siteAnalysisData?.structured_data && (
        <Card>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                  Comprehensive SEO Analysis Complete
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your site has been analyzed for meta tags, structured data, OpenGraph, sitemap, canonical URLs, and more. Check each section above for detailed insights and recommendations.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}



      {/* Action Buttons */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Need Fresh Site Analysis?
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Get the latest on-page SEO analysis and recommendations from your AI assistant.
            </p>
          </div>
          <Button 
            onClick={requestSiteAnalysis}
            disabled={isGeneratingData}
            className="bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
          >
            {isGeneratingData ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Updating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Update Site Analysis
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
  }

  if (loading || pagespeedLoading || siteAnalysisLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="xl" />
        <span className="ml-3 text-gray-600 dark:text-gray-300">Loading SEO analytics...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('seo')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'seo'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            🎯 SEO Analytics
          </button>
          <button
            onClick={() => setActiveTab('site-analysis')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'site-analysis'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            🔍 Site Analysis
          </button>
          <button
            onClick={() => setActiveTab('pagespeed')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pagespeed'
                ? 'border-green-500 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            ⚡ PageSpeed Insights
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'seo' && (
        <div>{hasData ? <DataView /> : <EmptyState />}</div>
      )}
      
      {activeTab === 'site-analysis' && (
        <div>{hasSiteAnalysisData ? <SiteAnalysisDataView /> : <SiteAnalysisEmptyState />}</div>
      )}
      
      {activeTab === 'pagespeed' && (
        <div>{hasPagespeedData ? <PagespeedDataView /> : <PagespeedEmptyState />}</div>
      )}
    </div>
  )
}
export default SEO