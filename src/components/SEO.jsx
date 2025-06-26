import { useState, useEffect, useRef } from 'react'
import { Button, Card, Badge, Spinner } from 'flowbite-react'
import { useToast } from './Toast'
import ApexCharts from 'apexcharts'

const SEO = ({ adminData, settings }) => {
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

  // Re-initialize charts when switching back to SEO tab
  useEffect(() => {
    if (activeTab === 'seo' && seoData && hasData) {
      // Small delay to ensure DOM elements are visible
      const timeoutId = setTimeout(() => {
        initializeCharts(seoData)
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [activeTab, seoData, hasData])

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
          // Only initialize charts if we're on the SEO tab
          if (activeTab === 'seo') {
            setTimeout(() => {
              initializeCharts(data.data)
            }, 300)
          }
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
          // Check if we have meaningful data (not just empty arrays)
          const hasScores = data.data.scores && 
                           ((Array.isArray(data.data.scores) && data.data.scores.length > 0) ||
                            (typeof data.data.scores === 'object' && Object.keys(data.data.scores).length > 0));
          
          const hasCoreWebVitals = data.data.coreWebVitals && 
                                  ((Array.isArray(data.data.coreWebVitals) && data.data.coreWebVitals.length > 0) ||
                                   (typeof data.data.coreWebVitals === 'object' && Object.keys(data.data.coreWebVitals).length > 0));
          
          const hasOpportunities = data.data.opportunities && 
                                  ((Array.isArray(data.data.opportunities) && data.data.opportunities.length > 0) ||
                                   (typeof data.data.opportunities === 'object' && Object.keys(data.data.opportunities).length > 0));
          
          
          
          if (hasScores || hasCoreWebVitals || hasOpportunities || data.data.lighthouse) {
            setPagespeedData(data.data)
            setHasPagespeedData(true)
          } else {
            setHasPagespeedData(false)
          }
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
    // Clean up existing charts first to prevent duplicates
    chartInstancesRef.current.forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        try {
          chart.destroy()
        } catch (error) {
          console.warn('Error destroying existing chart during re-initialization:', error)
        }
      }
    })
    chartInstancesRef.current = []

    // Ensure DOM elements are available before rendering
    const checkRefsAndRender = (attempt = 0) => {
      // Check if we're still on the SEO tab and elements are visible
      if (activeTab !== 'seo') return
      
      if (keywordRankingsChartRef.current && 
          organicTrafficChartRef.current && 
          competitorChartRef.current && 
          technicalScoreChartRef.current) {
        renderCharts(data)
      } else if (attempt < 10) {
        // Retry up to 10 times with increasing delay if refs are not ready
        setTimeout(() => checkRefsAndRender(attempt + 1), 100 + (attempt * 50))
      } else {
        console.warn('Chart refs not ready after 10 attempts, giving up')
      }
    }

    setTimeout(() => checkRefsAndRender(), 50)
  }

  const renderCharts = (data) => {
    // Don't render charts if not on SEO tab
    if (activeTab !== 'seo') return

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

    // Keyword Rankings Chart (Line Chart)
    if (keywordRankingsChartRef.current && data.keywordRankings && document.documentElement) {
      try {
        // Filter unique keywords and ensure we have valid data
        const uniqueKeywords = data.keywordRankings.filter((item, index, arr) => 
          item.keyword && 
          arr.findIndex(k => k.keyword === item.keyword) === index
        ).map(item => ({
          keyword: item.keyword,
          position: item.position || null, // Use null for unranked keywords
          volume: item.search_volume || item.volume || 0,
          difficulty: item.difficulty || 0,
          cpc: item.cpc || 0,
          competition: item.competition || 'UNKNOWN'
        }))
        
        if (uniqueKeywords.length === 0) {
          return
        }
        
        // Separate ranked and unranked keywords for better visualization
        const rankedKeywords = uniqueKeywords.filter(k => k.position !== null && k.position !== undefined && k.position > 0)
        const unrankedKeywords = uniqueKeywords.filter(k => k.position === null || k.position === undefined || k.position <= 0)
        
        // Combine all keywords: ranked ones keep their positions, unranked get 100+ positions
        const keywordsToShow = [
          ...rankedKeywords, // Keywords with actual positions
          ...unrankedKeywords.map((keyword, index) => ({
            ...keyword,
            position: 100 + (index * 2), // Place unranked keywords at 100+ (bottom of chart)
            isUnranked: true // Flag to identify unranked keywords
          }))
        ]
        
        const keywordOptions = {
          chart: {
            height: 350,
            type: 'line', // Explicitly set to line chart
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false },
            zoom: { enabled: false }
          },
          series: [{
            name: 'Search Position',
            type: 'line', // Explicitly set series type to line
            data: keywordsToShow.map(item => ({
              x: item.keyword,
              y: item.position
            }))
          }],
          colors: ['#3B82F6'],
          dataLabels: {
            enabled: true,
            formatter: function(val) {
              return `#${Math.round(val)}`
            },
            style: {
              fontSize: '11px',
              fontWeight: 'bold',
              colors: ['#FFFFFF']
            },
            background: {
              enabled: true,
              foreColor: '#fff',
              borderRadius: 4,
              borderWidth: 1,
              borderColor: '#3B82F6',
              opacity: 0.9
            },
            offsetY: -8
          },
          stroke: {
            curve: 'smooth', // Use smooth curve for better line visualization
            width: 3,
            lineCap: 'round'
          },
          markers: {
            size: keywordsToShow.map(keyword => keyword.isUnranked ? 8 : 6), // Larger markers for unranked keywords
            colors: keywordsToShow.map(keyword => keyword.isUnranked ? '#F59E0B' : '#3B82F6'), // Orange for unranked, blue for ranked
            strokeColors: '#fff',
            strokeWidth: 2,
            hover: {
              sizeOffset: 3
            }
          },
          xaxis: {
            type: 'category',
            categories: keywordsToShow.map(item => item.keyword), // Explicitly set categories
            labels: {
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280',
                fontSize: '12px'
              },
              rotate: keywordsToShow.length > 3 ? -45 : 0,
              maxHeight: 120
            }
          },
          yaxis: {
            reversed: true, // Lower position numbers are better (rank 1 = top)
            min: 1,
            max: function(max) {
              // Extend max to accommodate unranked keywords at 100+
              const hasUnranked = unrankedKeywords.length > 0
              return hasUnranked ? Math.max(110, max + 5) : Math.min(100, max + 5)
            },
            title: {
              text: 'Search Position (Lower is Better)',
              style: {
                color: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
              }
            },
            labels: {
              formatter: function(val) {
                if (val >= 100) {
                  return 'Unranked'
                }
                return '#' + Math.round(val)
              },
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
              }
            }
          },
          grid: {
            borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#E5E7EB',
            strokeDashArray: 3,
            xaxis: {
              lines: {
                show: true
              }
            },
            yaxis: {
              lines: {
                show: true
              }
            }
          },
          theme: {
            mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
          },
          tooltip: {
            shared: false,
            intersect: true,
            x: {
              show: true,
              formatter: function(value, { dataPointIndex }) {
                const keyword = keywordsToShow[dataPointIndex]
                return keyword ? keyword.keyword : value
              }
            },
            y: {
              formatter: function(value, { dataPointIndex }) {
                const keyword = keywordsToShow[dataPointIndex]
                if (!keyword) return value
                
                if (keyword.isUnranked) {
                  return 'Unranked'
                }
                return '#' + value
              },
              title: {
                formatter: function() {
                  return 'Position:'
                }
              }
            },
            marker: {
              show: true
            },
            custom: function({series, seriesIndex, dataPointIndex, w}) {
              const keyword = keywordsToShow[dataPointIndex]
              if (!keyword) return ''
              
              const positionText = keyword.isUnranked ? 'Unranked' : `#${keyword.position}`
              const bgColor = keyword.isUnranked ? '#FEF3C7' : '#FFFFFF'
              const textColor = keyword.isUnranked ? '#92400E' : '#374151'
              const borderColor = keyword.isUnranked ? '#F59E0B' : '#D1D5DB'
              
              return `
                <div style="padding: 12px; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                  <div style="font-weight: 600; color: ${textColor}; margin-bottom: 4px;">${keyword.keyword}</div>
                  <div style="font-size: 14px; color: ${textColor};">Position: ${positionText}</div>
                  ${keyword.isUnranked ? '<div style="font-size: 12px; color: #92400E; margin-top: 2px;">Not currently ranking in top 100</div>' : ''}
                  ${keyword.volume ? `<div style="font-size: 12px; color: ${textColor}; margin-top: 2px;">Volume: ${keyword.volume.toLocaleString()}/month</div>` : ''}
                  ${keyword.difficulty ? `<div style="font-size: 12px; color: ${textColor}; margin-top: 2px;">Difficulty: ${keyword.difficulty}%</div>` : ''}
                  ${keyword.cpc ? `<div style="font-size: 12px; color: ${textColor}; margin-top: 2px;">CPC: $${keyword.cpc}</div>` : ''}
                </div>
              `
            }
          },
          // Add annotations to separate ranked from unranked keywords
          annotations: unrankedKeywords.length > 0 ? {
            yaxis: [{
              y: 100,
              borderColor: '#F59E0B',
              strokeDashArray: 5,
              label: {
                borderColor: '#F59E0B',
                style: {
                  color: '#fff',
                  background: '#F59E0B',
                  fontSize: '11px'
                },
                text: 'Unranked Keywords (100+)',
                position: 'left'
              }
            }]
          } : {}
        }
        
        const chart = new ApexCharts(keywordRankingsChartRef.current, keywordOptions)
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
        
        const chart = new ApexCharts(organicTrafficChartRef.current, trafficOptions)
        chartInstancesRef.current.push(chart)
        chart.render()
      } catch (error) {
        console.error('Error rendering organic traffic chart:', error)
      }
    }

    // Competitor Analysis Chart - Horizontal Bar Chart
    if (competitorChartRef.current && data.competitors && document.documentElement) {
      try {
        // Sort competitors by authority for better visualization
        const sortedCompetitors = [...data.competitors].sort((a, b) => (b.authority || 0) - (a.authority || 0))
        
        const competitorOptions = {
          chart: {
            height: Math.max(350, sortedCompetitors.length * 45), // Dynamic height based on competitor count
            type: 'bar',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
          },
          series: [
            {
              name: 'Domain Authority',
              data: sortedCompetitors.map(item => {
                const authority = item.authority || 0
                // Color coding based on domain authority
                let fillColor
                if (authority >= 80) fillColor = '#10B981' // Green - Excellent
                else if (authority >= 60) fillColor = '#F59E0B' // Yellow - Good  
                else if (authority >= 40) fillColor = '#8B5CF6' // Purple - Moderate
                else fillColor = '#EF4444' // Red - Poor
                
                return {
                  x: item.domain,
                  y: authority,
                  fillColor: fillColor,
                  goals: [
                    {
                      name: 'Excellent',
                      value: 80,
                      strokeHeight: 2,
                      strokeColor: '#10B981'
                    },
                    {
                      name: 'Good',
                      value: 60,
                      strokeHeight: 2,
                      strokeColor: '#F59E0B'
                    }
                  ]
                }
              })
            }
          ],
          plotOptions: {
            bar: {
              horizontal: true,
              borderRadius: 6,
              distributed: true, // Enable different colors for each bar
              dataLabels: {
                position: 'center'
              }
            }
          },
          colors: sortedCompetitors.map(item => {
            const authority = item.authority || 0
            if (authority >= 80) return '#10B981' // Green - Excellent
            else if (authority >= 60) return '#F59E0B' // Yellow - Good
            else if (authority >= 40) return '#8B5CF6' // Purple - Moderate
            else return '#EF4444' // Red - Poor
          }),
          dataLabels: {
            enabled: true,
            textAnchor: 'middle',
            offsetX: 0,
            formatter: function(val, opts) {
              const competitor = sortedCompetitors[opts.dataPointIndex]
              const keywords = competitor.keywords ? 
                (competitor.keywords >= 1000 ? (competitor.keywords/1000).toFixed(1) + 'K' : competitor.keywords) : 
                'N/A'
              const traffic = competitor.traffic ? 
                (competitor.traffic >= 1000 ? (competitor.traffic/1000).toFixed(1) + 'K' : competitor.traffic) : 
                'N/A'
              
              // For very short bars, show abbreviated text
              if (val < 20) {
                return `${val} DA`
              }
              // For medium bars, show medium text
              if (val < 40) {
                return `${val} DA • ${keywords} kw`
              }
              // For long bars, show full text
              return `${val} DA • ${keywords} keywords • ${traffic} traffic`
            },
            style: {
              fontSize: '11px',
              fontWeight: '600',
              colors: sortedCompetitors.map(item => {
                const authority = item.authority || 0
                // Use white text for all bars for better contrast
                return '#FFFFFF'
              })
            },
            dropShadow: {
              enabled: true,
              top: 1,
              left: 1,
              blur: 1,
              opacity: 0.45
            }
          },
          xaxis: {
            categories: sortedCompetitors.map(item => item.domain),
            labels: {
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
              }
            }
          },
          yaxis: {
            title: {
              text: 'Domain Authority',
              style: {
                color: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
              }
            },
            labels: {
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280',
                fontSize: '11px'
              },
              maxWidth: 120
            }
          },
          grid: {
            borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#E5E7EB',
            xaxis: {
              lines: {
                show: true
              }
            },
            yaxis: {
              lines: {
                show: false
              }
            }
          },
          theme: {
            mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
          },
          tooltip: {
            custom: function({ seriesIndex, dataPointIndex, w }) {
              const competitor = sortedCompetitors[dataPointIndex]
              const authorityColor = competitor.authority >= 80 ? '#10B981' : 
                                   competitor.authority >= 60 ? '#F59E0B' : 
                                   competitor.authority >= 40 ? '#8B5CF6' : '#EF4444'
              
              return `
                <div style="padding: 12px; background: ${document.documentElement.classList.contains('dark') ? '#1F2937' : '#FFFFFF'}; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                  <div style="font-weight: bold; margin-bottom: 8px; color: ${document.documentElement.classList.contains('dark') ? '#F9FAFB' : '#1F2937'}; font-size: 14px;">
                    ${competitor.domain}
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <div style="width: 12px; height: 12px; background: ${authorityColor}; border-radius: 2px;"></div>
                      <span style="color: ${document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#6B7280'};">
                        Domain Authority: <strong style="color: ${authorityColor};">${competitor.authority || 'N/A'}</strong>
                      </span>
                    </div>
                    <div style="color: ${document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#6B7280'};">
                      Keywords: <strong>${(competitor.keywords || 0).toLocaleString()}</strong>
                    </div>
                    <div style="color: ${document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#6B7280'};">
                      Traffic: <strong>${(competitor.traffic || 0).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              `
            }
          },
          annotations: {
            yaxis: [
              {
                y: 80,
                borderColor: '#10B981',
                label: {
                  borderColor: '#10B981',
                  style: {
                    color: '#fff',
                    background: '#10B981',
                    fontSize: '10px'
                  },
                  text: 'Excellent (80+)'
                }
              },
              {
                y: 60,
                borderColor: '#F59E0B',
                label: {
                  borderColor: '#F59E0B',
                  style: {
                    color: '#fff',
                    background: '#F59E0B',
                    fontSize: '10px'
                  },
                  text: 'Good (60+)'
                }
              }
            ]
          }
        }
        
        const chart = new ApexCharts(competitorChartRef.current, competitorOptions)
        chartInstancesRef.current.push(chart)
        chart.render()
      } catch (error) {
        console.error('Error rendering competitor chart:', error)
      }
    }

    // Technical SEO Score Chart (Horizontal Bar)
    if (technicalScoreChartRef.current && data.technicalScores && document.documentElement) {
      try {
        const technicalOptions = {
          chart: {
            height: 350,
            type: 'bar',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
          },
          series: [{
            name: 'Score',
            data: [
              { x: 'Performance', y: data.technicalScores.performance || 0 },
              { x: 'Accessibility', y: data.technicalScores.accessibility || 0 },
              { x: 'Best Practices', y: data.technicalScores.bestPractices || 0 },
              { x: 'SEO', y: data.technicalScores.seo || 0 }
            ]
          }],
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
          plotOptions: {
            bar: {
              horizontal: true,
              borderRadius: 8,
              distributed: true,
              barHeight: '60%',
              dataLabels: {
                position: 'center'
              }
            }
          },
          dataLabels: {
            enabled: true,
            formatter: function(val) {
              return val + '%'
            },
            style: {
              fontSize: '14px',
              fontWeight: 'bold',
              colors: ['#FFFFFF']
            }
          },
          xaxis: {
            type: 'numeric',
            min: 0,
            max: 100,
            labels: {
              formatter: function(val) {
                return val + '%'
              },
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280'
              }
            }
          },
          yaxis: {
            labels: {
              style: {
                colors: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#6B7280',
                fontSize: '13px'
              }
            }
          },
          grid: {
            borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#E5E7EB',
            xaxis: {
              lines: { show: true }
            },
            yaxis: {
              lines: { show: false }
            }
          },
          tooltip: {
            y: {
              formatter: function(val) {
                return val + '%'
              }
            }
          },
          theme: {
            mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
          }
        }
        
        const chart = new ApexCharts(technicalScoreChartRef.current, technicalOptions)
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
          // Initialize charts with sample data, but only if we're on the SEO tab
          if (activeTab === 'seo') {
            setTimeout(() => {
              initializeCharts(sampleData)
            }, 300)
          }
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

  const clearSampleData = async () => {
    if (!adminData?.restUrl || !adminData?.nonce) {
      showError('Unable to connect to WordPress API')
      return
    }

    setIsGeneratingData(true)

    try {
      const response = await fetch(`${adminData.restUrl}magicassistant/v1/clear-sample-seo-data`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonce
        }
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(result.message || 'Sample data cleared successfully')
        // Reload the fresh data
        await loadSEOData()
      } else {
        showError(result.message || 'Failed to clear sample data')
      }
    } catch (error) {
      console.error('Failed to clear sample data:', error)
      showError('Failed to clear sample data. Please try again.')
    } finally {
      setIsGeneratingData(false)
    }
  }

  const refreshSEOAnalytics = async () => {
    if (!adminData?.restUrl || !adminData?.nonce) {
      showError('Unable to connect to WordPress API')
      return
    }

    setIsGeneratingData(true)

    try {
      const response = await fetch(`${adminData.restUrl}magicassistant/v1/refresh-seo-analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonce
        }
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(result.message || 'SEO analytics refreshed successfully')
        // Load the refreshed analytics data
        setSeoData(result.data || {})
        setHasData(result.data && Object.keys(result.data).length > 0)
        
        if (result.data && Object.keys(result.data).length > 0 && activeTab === 'seo') {
          setTimeout(() => {
            initializeCharts(result.data)
          }, 300)
        }
      } else {
        showError(result.message || 'No data available to refresh from. Please run some SEO analysis tools first.')
      }
    } catch (error) {
      console.error('Failed to refresh SEO analytics:', error)
      showError('Failed to refresh SEO analytics. Please try again.')
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
    const message = `Please run a PageSpeed Insights analysis on my website. I need you to:

1. Use pagespeed_analyze tool (dedicated Google PageSpeed Insights API)
2. Get detailed performance metrics including Core Web Vitals 
3. Identify optimization opportunities
4. Provide actionable recommendations to improve site speed

Note: This tool uses Google PageSpeed Insights API directly and saves data only to the PageSpeed section (not mixed with SEO data). This ensures proper data separation and prevents database bloat from binary image data.`

    // Save the message and switch to chat
    sessionStorage.setItem('mat_prefill_message', message)
    
    const url = new URL(window.location)
    url.searchParams.set('tab', 'chat')
    window.history.pushState({}, '', url)
    
    window.dispatchEvent(new CustomEvent('mat_switch_tab', { 
      detail: { tab: 'chat', prefillMessage: message } 
    }))
    
    showSuccess('Redirecting to AI Assistant for PageSpeed analysis...')
  }

  const requestTechnicalAudit = () => {
    const message = `Please perform a comprehensive technical SEO audit of my website. I need you to:

1. Use dataforseo_technical_audit for DataForSEO's Lighthouse analysis (focuses on SEO-specific technical issues)
2. For performance metrics and Core Web Vitals, use the dedicated pagespeed_analyze tool instead
3. Analyze accessibility issues and best practices violations  
4. Identify technical SEO issues and opportunities
5. Provide specific recommendations to improve technical scores

Important: Use pagespeed_analyze for performance data (Core Web Vitals, PageSpeed scores) and dataforseo_technical_audit for broader technical SEO insights. This ensures proper data separation and better analysis coverage.`

    // Save the message and switch to chat
    sessionStorage.setItem('mat_prefill_message', message)
    
    const url = new URL(window.location)
    url.searchParams.set('tab', 'chat')
    window.history.pushState({}, '', url)
    
    window.dispatchEvent(new CustomEvent('mat_switch_tab', { 
      detail: { tab: 'chat', prefillMessage: message } 
    }))
    
    showSuccess('Redirecting to AI Assistant for technical audit...')
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
            Let our AI analyze your website's SEO performance, keyword rankings, competitors, and technical health using DataForSEO tools. Results will be automatically saved to this dashboard.
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

      {settings?.show_tips !== false && (
        <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            💡 <strong>Tip:</strong> Real analysis provides actionable insights specific to your website, while sample data helps you understand the interface.
          </p>
        </div>
      )}
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Keyword Rankings
            </h3>
            {seoData?.keywordRankings && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {seoData.keywordRankings.filter(k => k.keyword && k.position).length} keywords
              </span>
            )}
          </div>
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
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 space-y-1">
            <div>Domain Authority comparison sorted by performance</div>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Excellent (80+)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span>Good (60-79)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span>Moderate (40-59)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Poor (&lt;40)</span>
              </div>
            </div>
          </div>
          <div ref={competitorChartRef}></div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Technical SEO Scores
          </h3>
          <div ref={technicalScoreChartRef}></div>
          
          {/* No Technical Data Message */}
          {!seoData?.technicalScores && !seoData?.technicalAuditInfo && (
            <div className="text-center py-8">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H9z" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium mb-2">No technical audit data available</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                  Run a technical audit to get performance, accessibility, and SEO scores
                </p>
                <Button
                  size="sm"
                  onClick={requestTechnicalAudit}
                  disabled={isGeneratingData}
                  className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-500"
                >
                  {isGeneratingData ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Running Audit...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Run Technical Audit
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Data Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
                      <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Keywords Analysis
                </h3>
                {seoData?.keywordRankings && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {Math.min(10, seoData.keywordRankings.filter(k => k.keyword && k.position).length)} of {seoData.keywordRankings.filter(k => k.keyword && k.position).length} keywords
                  </p>
                )}
              </div>
            </div>
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
                {(() => {
                  // Get unique keywords by filtering duplicates
                  const uniqueKeywords = seoData?.keywordRankings?.filter((item, index, arr) => 
                    item.keyword && item.position && arr.findIndex(k => k.keyword === item.keyword) === index
                  ) || []
                  
                  // If we have no keywords, show empty state
                  if (uniqueKeywords.length === 0) {
                    return null
                  }
                  
                  // Show all unique keywords (up to 10 for table readability)
                  return uniqueKeywords.slice(0, 10).map((keyword, index) => (
                    <tr key={`${keyword.keyword}-${index}`} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {keyword.keyword}
                        {/* Show data source indicator */}
                        {keyword.source && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            {keyword.source}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={keyword.position <= 10 ? 'success' : keyword.position <= 30 ? 'warning' : 'failure'}>
                          #{keyword.position}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{keyword.volume?.toLocaleString() || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <Badge color={keyword.difficulty <= 30 ? 'success' : keyword.difficulty <= 60 ? 'warning' : 'failure'}>
                          {keyword.difficulty || 'N/A'}%
                        </Badge>
                      </td>
                    </tr>
                  ))
                })() || (
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
                    <td colSpan="4" className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">No competitor data available</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">Ask your AI assistant to analyze competitor data with DataForSEO tools</p>
                      </div>
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

      {settings?.show_tips !== false && (
        <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            💡 <strong>Tip:</strong> Site analysis examines your website's technical SEO elements to identify optimization opportunities for better search engine visibility.
          </p>
        </div>
      )}
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

      {settings?.show_tips !== false && (
        <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            💡 <strong>Tip:</strong> Real analysis provides actionable insights specific to your website, while sample data helps you understand the interface.
          </p>
        </div>
      )}
    </div>
  )

  const PagespeedDataView = () => {
    // Helper function to get score color and background
    const getScoreColor = (score) => {
      if (score >= 90) return 'text-green-600 dark:text-green-400'
      if (score >= 50) return 'text-yellow-600 dark:text-yellow-400'
      return 'text-red-600 dark:text-red-400'
    }
    
    const getScoreBgColor = (score) => {
      if (score >= 90) return 'bg-green-100 dark:bg-green-900/30'
      if (score >= 50) return 'bg-yellow-100 dark:bg-yellow-900/30'
      return 'bg-red-100 dark:bg-red-900/30'
    }

    const getBadgeColor = (score) => {
      if (score >= 90) return 'success'
      if (score >= 50) return 'warning'
      return 'failure'
    }

    // Helper to format bytes
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    // Helper to format milliseconds
    const formatMs = (ms) => {
      if (ms >= 1000) {
        return (ms / 1000).toFixed(1) + ' s'
      }
      return Math.round(ms) + ' ms'
    }

    // Parse raw response data for detailed insights
    const rawData = pagespeedData?.raw_response || pagespeedData?.raw_data
    const lighthouseData = rawData?.raw_data?.lighthouseResult || rawData?.lighthouseResult

    // Extract all category scores from lighthouse data
    const getAllScores = () => {
      const scores = {}
      
      // First check if we have scores in the raw response
      if (rawData?.scores) {
        Object.entries(rawData.scores).forEach(([key, value]) => {
          scores[key] = value
        })
      }
      
      // Then extract category scores from lighthouse data
      if (lighthouseData?.categories) {
        Object.entries(lighthouseData.categories).forEach(([key, category]) => {
          scores[key] = {
            score: Math.round(category.score * 100),
            title: category.title
          }
        })
      }
      
      // Check if we have stored scores but they're not showing up - look for alternative paths
      if (Object.keys(scores).length === 0) {
        
        // Check if scores are stored directly in pagespeedData
        if (pagespeedData?.scores) {
          Object.entries(pagespeedData.scores).forEach(([key, value]) => {
            scores[key] = value
          })
        }
        
        // Check if data is nested differently
        if (pagespeedData?.raw_response?.lighthouseResult?.categories) {
          Object.entries(pagespeedData.raw_response.lighthouseResult.categories).forEach(([key, category]) => {
            scores[key] = {
              score: Math.round(category.score * 100),
              title: category.title
            }
          })
        }
        
        // Check if data is in raw_data
        if (pagespeedData?.raw_data?.lighthouseResult?.categories) {
          Object.entries(pagespeedData.raw_data.lighthouseResult.categories).forEach(([key, category]) => {
            scores[key] = {
              score: Math.round(category.score * 100),
              title: category.title
            }
          })
        }
      }
      
      return scores
    }

    const allScores = getAllScores()

    // Get category-specific icon
    const getCategoryIcon = (category) => {
      const iconClass = "w-6 h-6"
      switch (category) {
        case 'performance':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )
        case 'accessibility':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )
        case 'best-practices':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        case 'seo':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )
        case 'pwa':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          )
        default:
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          )
      }
    }

    return (
      <div className="space-y-6">
        {/* PageSpeed Overview Cards - All Category Scores */}
        {Object.keys(allScores).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(allScores).map(([category, scoreData]) => (
              <Card key={category}>
                <div className="flex items-center">
                  <div className={`p-3 rounded-full ${getScoreBgColor(scoreData.score)}`}>
                    <div className={getScoreColor(scoreData.score)}>
                      {getCategoryIcon(category)}
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{scoreData.title}</p>
                    <p className={`text-2xl font-bold ${getScoreColor(scoreData.score)}`}>
                      {scoreData.score}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Critical Issues Alert - Updated to check all scores */}
        {Object.keys(allScores).length > 0 && (
          Object.values(allScores).some(score => score.score < 50) && (
            <Card>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                      Critical Issues Detected
                    </h3>
                    <div className="text-sm text-red-700 dark:text-red-300 space-y-1">
                      {Object.entries(allScores).filter(([_, score]) => score.score < 50).map(([category, score]) => (
                        <p key={category}>• {score.title} score ({score.score}) is critically low and needs immediate attention</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )
        )}

        {/* Enhanced Core Web Vitals */}
        {((rawData?.core_web_vitals || rawData?.coreWebVitals || pagespeedData?.coreWebVitals) && Object.keys(rawData?.core_web_vitals || rawData?.coreWebVitals || pagespeedData?.coreWebVitals || {}).length > 0) && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              ⚡ Core Web Vitals
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(rawData?.core_web_vitals || rawData?.coreWebVitals || pagespeedData?.coreWebVitals || {}).map(([metric, data]) => {
                const score = data.score !== null ? data.score : (data.score === 0 ? 0 : null)
                const scoreValue = score !== null ? (score <= 1 ? score * 100 : score) : null
                
                return (
                  <div key={metric} className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-gray-300 dark:border-gray-600">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">{data.title || metric}</h4>
                    <p className="text-3xl font-bold mb-2" style={{
                      color: scoreValue !== null 
                        ? (scoreValue >= 90 ? '#059669' : scoreValue >= 50 ? '#d97706' : '#dc2626')
                        : '#6b7280'
                    }}>
                      {data.displayValue}
                    </p>
                    {scoreValue !== null && (
                      <div className="space-y-1">
                        <Badge color={getBadgeColor(scoreValue)} size="sm" className="justify-self-center">
                          {scoreValue >= 90 ? 'Good' : scoreValue >= 50 ? 'Needs Improvement' : 'Poor'}
                        </Badge>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Score: {Math.round(scoreValue)}/100
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Raw value: {typeof data.value === 'number' ? data.value.toFixed(2) : data.value}
                      {typeof data.value === 'number' && data.value > 1000 ? 'ms' : (data.value < 1 ? '' : 'ms')}
                    </p>
                  </div>
                )
              })}
            </div>
            {settings?.show_tips !== false && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Understanding Core Web Vitals</h4>
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <p><strong>LCP (Largest Contentful Paint):</strong> Time until largest content element loads (Good: &lt;2.5s)</p>
                  <p><strong>FID (First Input Delay):</strong> Time until page becomes interactive (Good: &lt;100ms)</p>
                  <p><strong>CLS (Cumulative Layout Shift):</strong> Visual stability measure (Good: &lt;0.1)</p>
                  <p><strong>FCP (First Contentful Paint):</strong> Time until first content appears (Good: &lt;1.8s)</p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Warning for moderately low scores */}
        {Object.keys(allScores).length > 0 && (
          Object.values(allScores).some(score => score.score >= 50 && score.score < 80) && (
            <Card>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                      Areas for Improvement
                    </h3>
                    <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                      {Object.entries(allScores).filter(([_, score]) => score.score >= 50 && score.score < 80).map(([category, score]) => (
                        <p key={category}>• {score.title} score ({score.score}) could be improved</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )
        )}

        {/* Action Items Summary */}
        {rawData?.opportunities && rawData.opportunities.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🎯 Priority Action Items
            </h3>
            <div className="space-y-3">
              {rawData.opportunities
                .filter(opp => opp.score === 0 || opp.score < 0.5)
                .slice(0, 5)
                .map((opportunity, index) => (
                <div key={index} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-sm font-medium">
                        {index + 1}
                      </span>
                    </div>
                    <div className="ml-3">
                      <h4 className="font-medium text-red-800 dark:text-red-200">{opportunity.title}</h4>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {opportunity.displayValue}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Detailed Audits from stored data */}
        {(pagespeedData?.audits || rawData?.audits) && (
          <div className="space-y-6">
            {/* Performance Metrics */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                🚀 Performance Metrics
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  'first-contentful-paint',
                  'largest-contentful-paint',
                  'total-blocking-time',
                  'cumulative-layout-shift',
                  'speed-index',
                  'interactive'
                ].map(auditId => {
                  const audit = (pagespeedData?.audits || rawData?.audits)?.[auditId]
                  if (!audit) return null
                  
                  return (
                    <div key={auditId} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">{audit.title}</h4>
                        {audit.score !== null && (
                          <Badge color={getBadgeColor(audit.score * 100)}>
                            {audit.score === 1 ? 'Good' : audit.score >= 0.9 ? 'Good' : audit.score >= 0.5 ? 'Needs Improvement' : 'Poor'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{audit.displayValue}</p>
                      {audit.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{audit.description.substring(0, 150)}...</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Failed Audits - Critical Issues */}
            {(() => {
              const audits = pagespeedData?.audits || rawData?.audits || {}
              const failedAudits = Object.entries(audits).filter(([_, audit]) => 
                audit.score !== null && audit.score < 0.5 && audit.scoreDisplayMode !== 'notApplicable'
              ).slice(0, 10)
              
              if (failedAudits.length === 0) return null
              
              return (
                <Card>
                  <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-4">
                    ⚠️ Failed Audits - Needs Attention ({failedAudits.length})
                  </h3>
                  <div className="space-y-4">
                    {failedAudits.map(([auditId, audit]) => (
                      <div key={auditId} className="border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-red-800 dark:text-red-200">{audit.title}</h4>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                              {audit.description ? audit.description.substring(0, 200) + '...' : 'No description available'}
                            </p>
                          </div>
                          <Badge color="failure" className="ml-2">
                            {audit.score !== null ? Math.round(audit.score * 100) : 'Failed'}
                          </Badge>
                        </div>
                        {audit.displayValue && (
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            Impact: {audit.displayValue}
                          </p>
                        )}
                        {audit.details && (
                          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                            {audit.details.overallSavingsMs && `Time savings: ${formatMs(audit.details.overallSavingsMs)}`}
                            {audit.details.overallSavingsBytes && ` • Data savings: ${formatBytes(audit.details.overallSavingsBytes)}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })()}

            {/* Resource Optimization Opportunities */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                🔧 Resource Optimization
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  'unused-css-rules',
                  'unused-javascript',
                  'unminified-javascript',
                  'render-blocking-resources',
                  'uses-responsive-images',
                  'legacy-javascript',
                  'uses-text-compression',
                  'uses-long-cache-ttl'
                ].map(auditId => {
                  const audit = (pagespeedData?.audits || rawData?.audits)?.[auditId]
                  if (!audit) return null
                  
                  return (
                    <div key={auditId} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">{audit.title}</h4>
                        {audit.score !== null && (
                          <Badge color={getBadgeColor(audit.score * 100)} size="sm">
                            {audit.score === 1 ? 'Optimized' : audit.score >= 0.9 ? 'Good' : audit.score >= 0.5 ? 'Moderate' : 'Poor'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{audit.displayValue}</p>
                      <div className="mt-2 space-y-1">
                        {audit.details?.overallSavingsMs && audit.details.overallSavingsMs > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            ⚡ Time savings: {formatMs(audit.details.overallSavingsMs)}
                          </p>
                        )}
                        {audit.details?.overallSavingsBytes && audit.details.overallSavingsBytes > 0 && (
                          <p className="text-xs text-purple-600 dark:text-purple-400">
                            💾 Data savings: {formatBytes(audit.details.overallSavingsBytes)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}

        {/* Comprehensive Resource Breakdown */}
        {(pagespeedData?.audits || rawData?.audits) && (
          <div className="space-y-6">
            {/* Resource Summary Overview */}
            {(() => {
              const audits = pagespeedData?.audits || rawData?.audits || {}
              const resourceSummary = audits['resource-summary']
              const networkRequests = audits['network-requests']
              
              if (!resourceSummary && !networkRequests) return null
              
              return (
                <Card>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    📊 Resource Loading Analysis
                  </h3>
                  
                  {/* Resource Types Breakdown */}
                  {resourceSummary?.details?.items && (
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Resource Types</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {resourceSummary.details.items
                          .filter(item => item.resourceType !== 'total')
                          .map((item, index) => (
                          <div key={index} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-center border">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label || item.resourceType}</p>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{item.requestCount}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">requests</p>
                            <p className="text-xs text-purple-600 dark:text-purple-400">{formatBytes(item.transferSize)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total Resources Summary */}
                  {(() => {
                    const totalItem = resourceSummary?.details?.items?.find(item => item.resourceType === 'total')
                    if (!totalItem) return null
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                          <h4 className="font-medium text-blue-800 dark:text-blue-200">Total Requests</h4>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalItem.requestCount}</p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                          <h4 className="font-medium text-purple-800 dark:text-purple-200">Transfer Size</h4>
                          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{formatBytes(totalItem.transferSize)}</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                          <h4 className="font-medium text-green-800 dark:text-green-200">Resource Size</h4>
                          <p className="text-2xl font-bold text-green-900 dark:text-green-100">{formatBytes(totalItem.resourceSize || 0)}</p>
                        </div>
                      </div>
                    )
                  })()}
                </Card>
              )
            })()}

            {/* Cache Performance */}
            {(() => {
              const audits = pagespeedData?.audits || rawData?.audits || {}
              const cacheAudit = audits['uses-long-cache-ttl']
              
              if (!cacheAudit || !cacheAudit.details?.items) return null
              
              return (
                <Card>
                  <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200 mb-4">
                    🗄️ Cache Performance Issues
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
                      <div>
                        <h4 className="font-medium text-orange-800 dark:text-orange-200">{cacheAudit.title}</h4>
                        <p className="text-sm text-orange-700 dark:text-orange-300">
                          {cacheAudit.displayValue} - Resources without proper cache headers
                        </p>
                      </div>
                      <Badge color={getBadgeColor(cacheAudit.score * 100)}>
                        {Math.round(cacheAudit.score * 100)}
                      </Badge>
                    </div>
                    
                    {cacheAudit.details.items.slice(0, 8).map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                        <span className="text-gray-900 dark:text-white truncate max-w-md" title={item.url}>
                          {item.url ? new URL(item.url).pathname.split('/').pop() || item.url : 'Unknown'}
                        </span>
                        <div className="text-right">
                          <p className="text-gray-600 dark:text-gray-400">{formatBytes(item.totalBytes)}</p>
                          <p className="text-xs text-orange-600 dark:text-orange-400">
                            {item.cacheLifetimeMs ? formatMs(item.cacheLifetimeMs) : 'No cache'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })()}
          </div>
        )}

        {/* Network Analysis */}
        {(lighthouseData?.audits?.['network-requests']?.details?.items || (pagespeedData?.audits || rawData?.audits)?.['server-response-time']) && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🌐 Network Performance Analysis
            </h3>
            <div className="space-y-4">
              {/* Server Response Time Issues */}
              {(() => {
                const audits = pagespeedData?.audits || rawData?.audits || lighthouseData?.audits || {}
                const serverResponseAudit = audits['server-response-time']
                
                if (!serverResponseAudit || serverResponseAudit.score >= 0.9) return null
                
                return (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                    <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                      🐌 Slow Server Response Detected
                    </h4>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      Server response time: {serverResponseAudit.displayValue} - 
                      Your server is taking too long to respond. Consider optimizing your backend, using a CDN, or upgrading your hosting.
                    </p>
                    <div className="mt-2">
                      <Badge color={getBadgeColor(serverResponseAudit.score * 100)}>
                        Score: {Math.round(serverResponseAudit.score * 100)}/100
                      </Badge>
                    </div>
                  </div>
                )
              })()}

              {/* Third Party Impact */}
              {(() => {
                const audits = pagespeedData?.audits || rawData?.audits || lighthouseData?.audits || {}
                const thirdPartyAudit = audits['third-party-summary']
                
                if (!thirdPartyAudit?.details?.items || thirdPartyAudit.details.items.length === 0) return null
                
                return (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Third-Party Impact</h4>
                    <div className="space-y-2">
                      {thirdPartyAudit.details.items.slice(0, 6).map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{item.entity}</span>
                          <div className="text-right">
                            <p className="text-sm text-gray-600 dark:text-gray-400">{formatBytes(item.transferSize)}</p>
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                              {formatMs(item.mainThreadTime)} blocking
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        📊 Total main thread blocking time: {thirdPartyAudit.displayValue}
                      </p>
                    </div>
                  </div>
                )
              })()}

              {/* Network RTT Information */}
              {(() => {
                const audits = pagespeedData?.audits || rawData?.audits || {}
                const networkRTT = audits['network-rtt']
                
                if (!networkRTT?.details?.items) return null
                
                return (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Network Round Trip Time</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {networkRTT.details.items.slice(0, 6).map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                          <span className="text-gray-900 dark:text-white truncate">{item.origin}</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{formatMs(item.rtt)}</span>
                        </div>
                      ))}
                    </div>
                    {settings?.show_tips !== false && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                        Lower RTT values indicate better network performance
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>
          </Card>
        )}

        {/* Performance Opportunities */}
        {(rawData?.opportunities || pagespeedData?.opportunities) && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🎯 Performance Opportunities
            </h3>
            <div className="space-y-4">
              {(rawData?.opportunities || pagespeedData?.opportunities || []).map((opportunity, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                        {opportunity.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {opportunity.description}
                      </p>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {opportunity.displayValue && (
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            💡 {opportunity.displayValue}
                          </span>
                        )}
                        {opportunity.overallSavingsMs && opportunity.overallSavingsMs > 0 && (
                          <span className="font-medium text-green-600 dark:text-green-400">
                            ⚡ {formatMs(opportunity.overallSavingsMs)} faster
                          </span>
                        )}
                        {opportunity.overallSavingsBytes && opportunity.overallSavingsBytes > 0 && (
                          <span className="font-medium text-purple-600 dark:text-purple-400">
                            💾 {formatBytes(opportunity.overallSavingsBytes)} less data
                          </span>
                        )}
                      </div>
                    </div>
                    {opportunity.score !== null && (
                      <Badge color={getBadgeColor(opportunity.score * 100)} className="ml-4">
                        {opportunity.score === 0 ? 'Critical' : opportunity.score < 0.5 ? 'Poor' : 'Good'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Comprehensive Diagnostics */}
        {(rawData?.diagnostics || pagespeedData?.diagnostics) && (
          <div className="space-y-6">
            {/* Accessibility Issues */}
            {(() => {
              const diagnostics = rawData?.diagnostics || pagespeedData?.diagnostics || []
              const accessibilityIssues = diagnostics.filter(d => 
                d.score !== null && d.score < 1 && (
                  d.title?.toLowerCase().includes('aria') ||
                  d.title?.toLowerCase().includes('accessibility') ||
                  d.title?.toLowerCase().includes('contrast') ||
                  d.id?.includes('aria') ||
                  d.id?.includes('color')
                )
              )
              
              if (accessibilityIssues.length === 0) return null
              
              return (
                <Card>
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-4">
                    ♿ Accessibility Issues ({accessibilityIssues.length})
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {accessibilityIssues.map((diagnostic, index) => (
                      <div key={index} className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-blue-800 dark:text-blue-200 text-sm">{diagnostic.title}</h4>
                          {diagnostic.score !== null && (
                            <Badge color={diagnostic.score === 1 ? 'success' : 'warning'} size="sm">
                              {diagnostic.score === 1 ? 'Pass' : 'Fail'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          {diagnostic.description ? diagnostic.description.substring(0, 150) + '...' : 'No description available'}
                        </p>
                        {diagnostic.displayValue && (
                          <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mt-1">
                            {diagnostic.displayValue}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })()}

            {/* SEO Issues */}
            {(() => {
              const diagnostics = rawData?.diagnostics || pagespeedData?.diagnostics || []
              const seoIssues = diagnostics.filter(d => 
                d.score !== null && d.score < 1 && (
                  d.title?.toLowerCase().includes('seo') ||
                  d.title?.toLowerCase().includes('meta') ||
                  d.title?.toLowerCase().includes('title') ||
                  d.title?.toLowerCase().includes('description') ||
                  d.title?.toLowerCase().includes('canonical') ||
                  d.title?.toLowerCase().includes('robots') ||
                  d.id?.includes('meta') ||
                  d.id?.includes('title') ||
                  d.id?.includes('canonical')
                )
              )
              
              if (seoIssues.length === 0) return null
              
              return (
                <Card>
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-4">
                    🔍 SEO Issues ({seoIssues.length})
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {seoIssues.map((diagnostic, index) => (
                      <div key={index} className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-green-800 dark:text-green-200 text-sm">{diagnostic.title}</h4>
                          {diagnostic.score !== null && (
                            <Badge color={diagnostic.score === 1 ? 'success' : 'warning'} size="sm">
                              {diagnostic.score === 1 ? 'Pass' : 'Fail'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          {diagnostic.description ? diagnostic.description.substring(0, 150) + '...' : 'No description available'}
                        </p>
                        {diagnostic.displayValue && (
                          <p className="text-xs font-medium text-green-800 dark:text-green-200 mt-1">
                            {diagnostic.displayValue}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })()}

            {/* Best Practices Issues */}
            {(() => {
              const diagnostics = rawData?.diagnostics || pagespeedData?.diagnostics || []
              const bestPracticesIssues = diagnostics.filter(d => 
                d.score !== null && d.score < 1 && (
                  d.title?.toLowerCase().includes('security') ||
                  d.title?.toLowerCase().includes('https') ||
                  d.title?.toLowerCase().includes('deprecated') ||
                  d.title?.toLowerCase().includes('console') ||
                  d.title?.toLowerCase().includes('errors') ||
                  d.title?.toLowerCase().includes('vulnerability') ||
                  d.id?.includes('security') ||
                  d.id?.includes('https') ||
                  d.id?.includes('errors')
                )
              )
              
              if (bestPracticesIssues.length === 0) return null
              
              return (
                <Card>
                  <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200 mb-4">
                    ✅ Best Practices Issues ({bestPracticesIssues.length})
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {bestPracticesIssues.map((diagnostic, index) => (
                      <div key={index} className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-purple-800 dark:text-purple-200 text-sm">{diagnostic.title}</h4>
                          {diagnostic.score !== null && (
                            <Badge color={diagnostic.score === 1 ? 'success' : 'warning'} size="sm">
                              {diagnostic.score === 1 ? 'Pass' : 'Fail'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-purple-700 dark:text-purple-300">
                          {diagnostic.description ? diagnostic.description.substring(0, 150) + '...' : 'No description available'}
                        </p>
                        {diagnostic.displayValue && (
                          <p className="text-xs font-medium text-purple-800 dark:text-purple-200 mt-1">
                            {diagnostic.displayValue}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })()}

            {/* Technical Diagnostics */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                🔧 Technical Diagnostics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(rawData?.diagnostics || pagespeedData?.diagnostics || [])
                  .filter(d => d.scoreDisplayMode === 'informative' || d.scoreDisplayMode === 'metricSavings')
                  .slice(0, 12)
                  .map((diagnostic, index) => (
                  <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">{diagnostic.title}</h4>
                    <p className="text-sm text-gray-900 dark:text-white font-bold">{diagnostic.displayValue || 'N/A'}</p>
                    {diagnostic.numericValue && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Raw value: {typeof diagnostic.numericValue === 'number' ? diagnostic.numericValue.toFixed(2) : diagnostic.numericValue}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Actionable Insights & Recommendations */}
        {(pagespeedData?.scores || pagespeedData?.opportunities || pagespeedData?.audits) && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🎯 Action Plan & Recommendations
            </h3>
            
            {/* Priority Actions */}
            {(() => {
              const scores = pagespeedData?.scores || {}
              const opportunities = pagespeedData?.opportunities || []
              const audits = pagespeedData?.audits || {}
              
              const criticalIssues = []
              const majorImprovements = []
              const quickWins = []
              
              // Analyze scores for critical issues
              Object.entries(scores).forEach(([category, scoreData]) => {
                if (scoreData.score < 50) {
                  criticalIssues.push({
                    type: 'score',
                    category: scoreData.title,
                    score: scoreData.score,
                    priority: 'critical',
                    impact: 'high'
                  })
                }
              })
              
              // Analyze opportunities for improvements
              opportunities.forEach(opp => {
                if (opp.score === 0 || opp.score < 0.5) {
                  if (opp.overallSavingsMs > 1000) {
                    majorImprovements.push({
                      type: 'opportunity',
                      title: opp.title,
                      savings: opp.overallSavingsMs,
                      priority: 'high',
                      impact: 'high'
                    })
                  } else if (opp.overallSavingsMs > 200) {
                    quickWins.push({
                      type: 'opportunity',
                      title: opp.title,
                      savings: opp.overallSavingsMs,
                      priority: 'medium',
                      impact: 'medium'
                    })
                  }
                }
              })
              
              return (
                <div className="space-y-6">
                  {/* Critical Issues */}
                  {criticalIssues.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                      <h4 className="font-medium text-red-800 dark:text-red-200 mb-3">🚨 Critical Issues (Immediate Action Required)</h4>
                      <div className="space-y-2">
                        {criticalIssues.map((issue, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm text-red-700 dark:text-red-300">
                              {issue.category} score is critically low
                            </span>
                            <Badge color="failure">{issue.score}/100</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Major Improvements */}
                  {majorImprovements.length > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                      <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-3">⚡ High-Impact Improvements</h4>
                      <div className="space-y-2">
                        {majorImprovements.slice(0, 5).map((improvement, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm text-orange-700 dark:text-orange-300">
                              {improvement.title}
                            </span>
                            <span className="text-green-600 dark:text-green-400 font-medium text-sm">
                              +{formatMs(improvement.savings)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Quick Wins */}
                  {quickWins.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                      <h4 className="font-medium text-green-800 dark:text-green-200 mb-3">✅ Quick Wins (Easy to Fix)</h4>
                      <div className="space-y-2">
                        {quickWins.slice(0, 5).map((win, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm text-green-700 dark:text-green-300">
                              {win.title}
                            </span>
                            <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">
                              +{formatMs(win.savings)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Overall Summary */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3">📊 Overall Performance Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      {Object.entries(scores).map(([category, scoreData]) => (
                        <div key={category}>
                          <p className="text-2xl font-bold" style={{
                            color: scoreData.score >= 90 ? '#059669' : scoreData.score >= 50 ? '#d97706' : '#dc2626'
                          }}>
                            {scoreData.score}
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">{scoreData.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Next Steps */}
                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">🎯 Recommended Next Steps</h4>
                    <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-decimal list-inside">
                      <li>Address critical issues first - focus on scores below 50</li>
                      <li>Implement high-impact improvements that save over 1 second</li>
                      <li>Optimize images and enable compression for quick wins</li>
                      <li>Review third-party scripts and consider lazy loading</li>
                      <li>Implement proper caching strategies</li>
                      <li>Monitor Core Web Vitals regularly</li>
                    </ol>
                  </div>
                </div>
              )
            })()}
          </Card>
        )}

        {/* Analysis Information */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📋 Analysis Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {(pagespeedData?.url || rawData?.url) && (
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Analyzed URL</p>
                <p className="text-gray-600 dark:text-gray-400 break-all">{pagespeedData?.url || rawData?.url}</p>
              </div>
            )}
            {(pagespeedData?.strategy || rawData?.strategy) && (
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Strategy</p>
                <Badge color={(pagespeedData?.strategy || rawData?.strategy) === 'mobile' ? 'info' : 'purple'} className="justify-self-start">
                  {pagespeedData?.strategy || rawData?.strategy}
                </Badge>
              </div>
            )}
            {(pagespeedData?.lastUpdated || rawData?.lastUpdated) && (
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Last Updated</p>
                <p className="text-gray-600 dark:text-gray-400">{new Date(pagespeedData?.lastUpdated || rawData?.lastUpdated).toLocaleString()}</p>
              </div>
            )}
            {(lighthouseData?.lighthouseVersion || rawData?.lighthouse?.lighthouseVersion) && (
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Lighthouse Version</p>
                <p className="text-gray-600 dark:text-gray-400">{lighthouseData?.lighthouseVersion || rawData?.lighthouse?.lighthouseVersion}</p>
              </div>
            )}
            {(lighthouseData?.fetchTime || rawData?.lighthouse?.fetchTime) && (
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Analysis Time</p>
                <p className="text-gray-600 dark:text-gray-400">{new Date(lighthouseData?.fetchTime || rawData?.lighthouse?.fetchTime).toLocaleString()}</p>
              </div>
            )}
            {(lighthouseData?.environment?.networkUserAgent || rawData?.lighthouse?.environment?.networkUserAgent) && (
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Test Environment</p>
                <p className="text-gray-600 dark:text-gray-400">Mobile Chrome Simulation</p>
              </div>
            )}
          </div>
          
          {/* Run Warnings */}
          {(lighthouseData?.runWarnings || rawData?.lighthouse?.runWarnings) && (lighthouseData?.runWarnings || rawData?.lighthouse?.runWarnings).length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Analysis Warnings</h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                {(lighthouseData?.runWarnings || rawData?.lighthouse?.runWarnings || []).map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Action Buttons */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Need Fresh PageSpeed Analysis?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Get the latest performance insights and Core Web Vitals from your AI assistant.
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Update PageSpeed Analysis
                </>
              )}
            </Button>
          </div>
        </Card>

      </div>
    )
  }

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
          </Card>

          <Card>
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
          </Card>

          <Card>
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
          </Card>

          <Card>
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
            <div className="space-y-4">
              {siteAnalysisData.summary.recommendations.map((recommendation, index) => {
                // Handle both old string format and new object format for backward compatibility
                const isNewFormat = typeof recommendation === 'object' && recommendation.title;
                const title = isNewFormat ? recommendation.title : recommendation;
                const description = isNewFormat ? recommendation.description : recommendation;
                const severity = isNewFormat ? recommendation.severity : 'medium';
                const affectedPages = isNewFormat ? recommendation.affected_pages : [];
                const affectedCount = isNewFormat ? recommendation.affected_count : 0;
                const showingCount = isNewFormat ? recommendation.showing_count : 0;
                
                // Severity colors and icons
                const severityConfig = {
                  high: {
                    bgColor: 'bg-red-50 dark:bg-red-900/20',
                    borderColor: 'border-red-200 dark:border-red-700',
                    iconColor: 'text-red-600 dark:text-red-400',
                    textColor: 'text-red-800 dark:text-red-200',
                    descColor: 'text-red-700 dark:text-red-300',
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    )
                  },
                  medium: {
                    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
                    borderColor: 'border-yellow-200 dark:border-yellow-700',
                    iconColor: 'text-yellow-600 dark:text-yellow-400',
                    textColor: 'text-yellow-800 dark:text-yellow-200',
                    descColor: 'text-yellow-700 dark:text-yellow-300',
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )
                  },
                  low: {
                    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
                    borderColor: 'border-blue-200 dark:border-blue-700',
                    iconColor: 'text-blue-600 dark:text-blue-400',
                    textColor: 'text-blue-800 dark:text-blue-200',
                    descColor: 'text-blue-700 dark:text-blue-300',
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )
                  }
                };
                
                const config = severityConfig[severity] || severityConfig.medium;
                
                return (
                  <div key={index} className={`p-4 ${config.bgColor} rounded-lg border ${config.borderColor}`}>
                    <div className="flex items-start">
                      <svg className={`w-5 h-5 ${config.iconColor} mr-3 mt-0.5 flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {config.icon}
                      </svg>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className={`text-sm font-semibold ${config.textColor}`}>
                            {title}
                          </h4>
                          {isNewFormat && (
                            <Badge 
                              color={severity === 'high' ? 'failure' : severity === 'medium' ? 'warning' : 'info'} 
                              size="sm"
                            >
                              {severity.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm ${config.descColor} mb-3`}>
                          {description}
                        </p>
                        
                        {/* Quick Fix Suggestions */}
                        {isNewFormat && settings?.show_tips !== false && (
                          <div className={`text-xs ${config.descColor} mb-3 p-2 bg-white dark:bg-gray-800 rounded border border-dashed ${config.borderColor}`}>
                            <strong>Quick Fix:</strong>{' '}
                            {(() => {
                              switch(recommendation.type) {
                                case 'meta_description':
                                  return 'Use an SEO plugin like Yoast or Rank Math, or edit each page directly and add unique meta descriptions 120-160 characters long.';
                                case 'meta_title':
                                  return 'Edit each page and ensure the title tag is 30-60 characters and includes your target keyword.';
                                case 'structured_data':
                                  return 'Install a schema plugin like Schema Pro or add JSON-LD markup manually to help search engines understand your content.';
                                case 'opengraph_image':
                                  return 'Set featured images for your posts/pages or use an SEO plugin to automatically generate OpenGraph images.';
                                case 'canonical_url':
                                  return 'Most SEO plugins handle this automatically. Check your plugin settings or add rel="canonical" tags manually.';
                                case 'title_length':
                                  return 'Edit titles to be 30-60 characters long. Too short titles waste space, too long titles get cut off in search results.';
                                case 'description_length':
                                  return 'Edit meta descriptions to be 120-160 characters. This is the optimal length for search result snippets.';
                                                                 default:
                                   return 'Use an SEO plugin or edit pages directly to address these issues.';
                               }
                             })()}
                             {affectedCount > 5 && (
                               <>
                                 <br />
                                 <strong>Bulk Fix:</strong> For {affectedCount} pages, consider using WordPress bulk edit or an SEO plugin's bulk optimization features.
                               </>
                             )}
                           </div>
                         )}
                        
                        {/* Affected Pages */}
                        {isNewFormat && affectedPages && affectedPages.length > 0 && (
                          <div className="mt-3">
                            <h5 className={`text-xs font-medium ${config.textColor} mb-2 uppercase tracking-wide`}>
                              Affected Pages:
                            </h5>
                            <div className="space-y-2">
                              {affectedPages.map((page, pageIndex) => (
                                <div key={pageIndex} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                        {page.title}
                                      </p>
                                      {page.post_type && (
                                        <Badge 
                                          color={page.post_type === 'page' ? 'purple' : page.post_type === 'post' ? 'blue' : 'gray'} 
                                          size="sm"
                                        >
                                          {page.post_type}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {page.url ? page.url.replace(/^https?:\/\/[^\/]+/, '') : 'N/A'}
                                    </p>
                                    {page.issues && page.issues.length > 0 && (
                                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                        Issues: {page.issues.join(', ')}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2 ml-3">
                                    {page.url && (
                                      <a 
                                        href={page.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                        title="View page"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                      </a>
                                    )}
                                    {page.post_id && (
                                      <a 
                                        href={`${adminData?.adminUrl || '/wp-admin/'}post.php?post=${page.post_id}&action=edit`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                                        title="Edit page"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                              
                              {/* Show count if there are more pages */}
                              {affectedCount > showingCount && (
                                <div className={`p-2 ${config.bgColor} rounded border border-dashed ${config.borderColor} text-center`}>
                                  <p className={`text-xs ${config.textColor} font-medium`}>
                                    + {affectedCount - showingCount} more pages with this issue
                                  </p>
                                  <p className={`text-xs ${config.descColor} mt-1`}>
                                    Run a fresh analysis to see all affected pages
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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