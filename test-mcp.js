/**
 * MCP Testing Script for MagicAssistant
 * 
 * This script tests the MCP server functionality
 * Run with: node test-mcp.js
 */

const SITE_URL = 'http://localhost:8000'; // Update with your WordPress site URL
const USERNAME = 'admin'; // WordPress admin username
const PASSWORD = 'password'; // WordPress admin password

class MCPTester {
    constructor(siteUrl) {
        this.siteUrl = siteUrl;
        this.token = null;
    }

    async authenticate() {
        console.log('🔐 Authenticating with WordPress...');
        
        try {
            const response = await fetch(`${this.siteUrl}/wp-json/magicassistant/v1/mcp/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
                },
                body: JSON.stringify({
                    expires_in: 3600
                })
            });

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            this.token = data.token;
            console.log('✅ Authentication successful');
            console.log(`📝 Token: ${this.token.substring(0, 20)}...`);
            return true;
        } catch (error) {
            console.error('❌ Authentication failed:', error.message);
            return false;
        }
    }

    async makeRPCCall(method, params = {}) {
        if (!this.token) {
            throw new Error('Not authenticated. Call authenticate() first.');
        }

        const response = await fetch(`${this.siteUrl}/wp-json/magicassistant/v1/mcp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: Math.random()
            })
        });

        if (!response.ok) {
            throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    async testListTools() {
        console.log('\n🛠️  Testing tools/list...');
        
        try {
            const result = await this.makeRPCCall('tools/list');
            
            if (result.error) {
                console.error('❌ Error:', result.error);
                return false;
            }

            console.log('✅ Available tools:');
            result.result.tools.forEach(tool => {
                console.log(`  - ${tool.name}: ${tool.description}`);
            });
            
            return true;
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            return false;
        }
    }

    async testGetSiteInfo() {
        console.log('\n🌍 Testing wp_get_site_info tool...');
        
        try {
            const result = await this.makeRPCCall('tools/call', {
                name: 'wp_get_site_info',
                arguments: {}
            });
            
            if (result.error) {
                console.error('❌ Error:', result.error);
                return false;
            }

            console.log('✅ Site info retrieved:');
            const siteInfo = JSON.parse(result.result.content[0].text);
            console.log(`  - Site Name: ${siteInfo.name}`);
            console.log(`  - URL: ${siteInfo.url}`);
            console.log(`  - WordPress Version: ${siteInfo.version}`);
            console.log(`  - Active Theme: ${siteInfo.active_theme.name}`);
            
            return true;
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            return false;
        }
    }

    async testGetPosts() {
        console.log('\n📝 Testing wp_get_posts tool...');
        
        try {
            const result = await this.makeRPCCall('tools/call', {
                name: 'wp_get_posts',
                arguments: {
                    per_page: 5,
                    status: 'publish'
                }
            });
            
            if (result.error) {
                console.error('❌ Error:', result.error);
                return false;
            }

            console.log('✅ Posts retrieved:');
            const posts = JSON.parse(result.result.content[0].text);
            console.log(`  - Total Posts: ${posts.total}`);
            console.log(`  - Retrieved: ${posts.posts.length}`);
            
            posts.posts.forEach((post, index) => {
                console.log(`  ${index + 1}. ${post.title} (ID: ${post.id})`);
            });
            
            return true;
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            return false;
        }
    }

    async testCreatePost() {
        console.log('\n📄 Testing wp_create_post tool...');
        
        try {
            const result = await this.makeRPCCall('tools/call', {
                name: 'wp_create_post',
                arguments: {
                    title: 'MCP Test Post - ' + new Date().toISOString(),
                    content: 'This post was created via MCP (Model Context Protocol) integration test.',
                    status: 'draft'
                }
            });
            
            if (result.error) {
                console.error('❌ Error:', result.error);
                return false;
            }

            console.log('✅ Post created:');
            const postData = JSON.parse(result.result.content[0].text);
            console.log(`  - Post ID: ${postData.id}`);
            console.log(`  - Title: ${postData.title}`);
            console.log(`  - Status: ${postData.status}`);
            console.log(`  - Edit Link: ${postData.edit_link}`);
            
            return true;
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            return false;
        }
    }

    async runAllTests() {
        console.log('🚀 Starting MagicAssistant MCP Tests...\n');
        
        // Authenticate first
        const authSuccess = await this.authenticate();
        if (!authSuccess) {
            console.log('\n❌ Tests aborted due to authentication failure');
            return;
        }

        // Run tests
        const tests = [
            this.testListTools(),
            this.testGetSiteInfo(),
            this.testGetPosts(),
            this.testCreatePost()
        ];

        const results = await Promise.allSettled(tests);
        
        // Summary
        console.log('\n📊 Test Summary:');
        let passed = 0;
        let failed = 0;
        
        results.forEach((result, index) => {
            const testNames = ['List Tools', 'Get Site Info', 'Get Posts', 'Create Post'];
            if (result.status === 'fulfilled' && result.value) {
                console.log(`✅ ${testNames[index]}: PASSED`);
                passed++;
            } else {
                console.log(`❌ ${testNames[index]}: FAILED`);
                failed++;
            }
        });
        
        console.log(`\n🎯 Results: ${passed} passed, ${failed} failed`);
        
        if (failed === 0) {
            console.log('🎉 All tests passed! MCP integration is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Please check the configuration.');
        }
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new MCPTester(SITE_URL);
    tester.runAllTests().catch(console.error);
}

module.exports = MCPTester; 