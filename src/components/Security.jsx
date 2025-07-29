import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Card, Button, Badge, Spinner } from 'flowbite-react'
import { useToast } from './Toast'
import ConfirmationModal from './ConfirmationModal'

/**
 * Security view – displays stored security scan results in a user-friendly format.
 * Data is loaded via the `security-data` REST endpoint and rendered in readable cards.
 */
const Security = ({ adminData, settings }) => {
  const [securityData, setSecurityData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasData, setHasData] = useState(false)
  const [isGeneratingData, setIsGeneratingData] = useState(false)
  const { showSuccess, showError } = useToast()
  const [showCriticalModal, setShowCriticalModal] = useState(false)

  // Refs for scrolling to sections from modal
  const coreSectionRef = useRef(null)
  const pluginSectionRef = useRef(null)
  const themeSectionRef = useRef(null)
  const filePermSectionRef = useRef(null)

  // htaccess editor state
  const [htaccessContent, setHtaccessContent] = useState('')
  const [showHtaccessEditor, setShowHtaccessEditor] = useState(false)
  const [htaccessLoading, setHtaccessLoading] = useState(false)
  const [htaccessSaving, setHtaccessSaving] = useState(false)
  // Ref for htaccess textarea to preserve focus
  const textareaRef = useRef(null)
  // Stable callback to close the htaccess editor (prevents refocusing on every render)
  const closeHtaccessEditor = useCallback(() => setShowHtaccessEditor(false), [])

  // Common htaccess security rules - moved to component level
  const htaccessRules = {
    wpIncludesLock: {
      name: 'WP-Includes Lock',
      description: 'Blocks direct access to wp-includes directory',
      code: `# Block access to wp-includes directory
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^wp-admin/includes/ - [F,L]
RewriteRule !^wp-includes/ - [S,L]
RewriteRule ^wp-includes/[^/]+\\.php$ - [F,L]
RewriteRule ^wp-includes/js/tinymce/langs/.+\\.php - [F,L]
RewriteRule ^wp-includes/theme-compat/ - [F,L]
</IfModule>`
    },
    blockXmlrpc: {
      name: 'Block XML-RPC',
      description: 'Disables XML-RPC to prevent brute force attacks',
      code: `# Block XML-RPC requests
<Files xmlrpc.php>
Order Deny,Allow
Deny from all
</Files>`
    },
    protectWpConfig: {
      name: 'Protect wp-config.php',
      description: 'Blocks direct access to wp-config.php file',
      code: `# Protect wp-config.php
<Files wp-config.php>
Order Allow,Deny
Deny from all
</Files>`
    },
    disableIndexes: {
      name: 'Disable Directory Browsing',
      description: 'Prevents directory listing when no index file exists',
      code: `# Disable directory browsing
Options -Indexes`
    },
    protectHtaccess: {
      name: 'Protect .htaccess',
      description: 'Prevents direct access to .htaccess file',
      code: `# Protect .htaccess file
<Files .htaccess>
Order Allow,Deny
Deny from all
</Files>`
    },
    blockSensitiveFiles: {
      name: 'Block Sensitive Files',
      description: 'Blocks access to common sensitive files',
      code: `# Block access to sensitive files
<FilesMatch "\\.(ini|log|conf|bak|sql|txt)$">
Order Allow,Deny
Deny from all
</FilesMatch>`
    },
    preventHotlinking: {
      name: 'Prevent Hotlinking',
      description: 'Prevents other sites from hotlinking your images',
      code: `# Prevent hotlinking
RewriteEngine On
RewriteCond %{HTTP_REFERER} !^$
RewriteCond %{HTTP_REFERER} !^http(s)?://(www\\.)?yourdomain.com [NC]
RewriteRule \\.(jpg|jpeg|png|gif|bmp)$ - [F]`
    },
    limitFileUploads: {
      name: 'Limit File Upload Size',
      description: 'Limits file upload size to prevent abuse',
      code: `# Limit file upload size
LimitRequestBody 10485760`
    },
    eightGFirewall: {
      name: '8G Firewall',
      description: 'Complete 8G Firewall v1.4 - by Perishable Press',
      code: `# 8G FIREWALL v1.4 20250120
# https://perishablepress.com/8g-firewall/

# 8G:[CORE]
ServerSignature Off
Options -Indexes
RewriteEngine On
RewriteBase /

# 8G:[QUERY STRING]
<IfModule mod_rewrite.c>

	RewriteCond %{QUERY_STRING} ^(%2d|-)[^=]+$ [NC,OR]
	RewriteCond %{QUERY_STRING} ([a-z0-9]{4000,}) [NC,OR]
	RewriteCond %{QUERY_STRING} (/|%2f)(:|%3a)(/|%2f) [NC,OR]
	RewriteCond %{QUERY_STRING} (etc/(hosts|motd|shadow)) [NC,OR]
	RewriteCond %{QUERY_STRING} (order(\\s|%20)by(\\s|%20)1--) [NC,OR]
	RewriteCond %{QUERY_STRING} (/|%2f)(\\*|%2a)(\\*|%2a)(/|%2f) [NC,OR]
	RewriteCond %{QUERY_STRING} (\`|<|>|\\^|\\||\\\\|0x00|%00|%0d%0a) [NC,OR]
	RewriteCond %{QUERY_STRING} (f?ckfinder|f?ckeditor|fullclick) [NC,OR]
	RewriteCond %{QUERY_STRING} ((.*)header:|(.*)set-cookie:(.*)=) [NC,OR]
	RewriteCond %{QUERY_STRING} (localhost|127(\\.|%2e)0(\\.|%2e)0(\\.|%2e)1) [NC,OR]
	RewriteCond %{QUERY_STRING} (cmd|command)(=|%3d)(chdir|mkdir)(.*)(x20) [NC,OR]
	RewriteCond %{QUERY_STRING} (globals|mosconfig([a-z_]{1,22})|request)(=|\\[) [NC,OR]
	RewriteCond %{QUERY_STRING} (/|%2f)((wp-)?config)((\\.|%2e)inc)?((\\.|%2e)php) [NC,OR]
	RewriteCond %{QUERY_STRING} (thumbs?(_editor|open)?|tim(thumbs?)?)((\\.|%2e)php) [NC,OR]
	RewriteCond %{QUERY_STRING} (absolute_|base|root_)(dir|path)(=|%3d)(ftp|https?) [NC,OR]
	RewriteCond %{QUERY_STRING} (s)?(ftp|inurl|php)(s)?(:(/|%2f|%u2215)(/|%2f|%u2215)) [NC,OR]
	RewriteCond %{QUERY_STRING} (\\.|20)(get|the)(_|%5f)(permalink|posts_page_url)(\\(|%28) [NC,OR]
	RewriteCond %{QUERY_STRING} ((boot|win)((\\.|%2e)ini)|etc(/|%2f)passwd|self(/|%2f)environ) [NC,OR]
	RewriteCond %{QUERY_STRING} (((/|%2f){3,3})|((\\.|%2e){3,3})|((\\.|%2e){2,2})(/|%2f|%u2215)) [NC,OR]
	RewriteCond %{QUERY_STRING} (benchmark|exec|fopen|function|html)(.*)(\\(|%28)(.*)(\\)|%29) [NC,OR]
	RewriteCond %{QUERY_STRING} (php)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}) [NC,OR]
	RewriteCond %{QUERY_STRING} (e|%65|%45)(v|%76|%56)(a|%61|%31)(l|%6c|%4c)(.*)(\\(|%28)(.*)(\\)|%29) [NC,OR]
	RewriteCond %{QUERY_STRING} (/|%2f)(=|%3d|$&|_mm|cgi(\\.|-)inurl(:|%3a)(/|%2f)|(mod|path)(=|%3d)(\\.|%2e)) [NC,OR]
	RewriteCond %{QUERY_STRING} (<|%3c)(.*)(e|%65|%45)(m|%6d|%4d)(b|%62|%42)(e|%65|%45)(d|%64|%44)(.*)(>|%3e) [NC,OR]
	RewriteCond %{QUERY_STRING} (<|%3c)(.*)(i|%69|%49)(f|%66|%46)(r|%72|%52)(a|%61|%41)(m|%6d|%4d)(e|%65|%45)(.*)(>|%3e) [NC,OR]
	RewriteCond %{QUERY_STRING} (<|%3c)(.*)(o|%4f|%6f)(b|%62|%42)(j|%4a|%6a)(e|%65|%45)(c|%63|%43)(t|%74|%54)(.*)(>|%3e) [NC,OR]
	RewriteCond %{QUERY_STRING} (<|%3c)(.*)(s|%73|%53)(c|%63|%43)(r|%72|%52)(i|%69|%49)(p|%70|%50)(t|%74|%54)(.*)(>|%3e) [NC,OR]
	RewriteCond %{QUERY_STRING} (\\+|%2b|%20)(d|%64|%44)(e|%65|%45)(l|%6c|%4c)(e|%65|%45)(t|%74|%54)(e|%65|%45)(\\+|%2b|%20) [NC,OR]
	RewriteCond %{QUERY_STRING} (\\+|%2b|%20)(i|%69|%49)(n|%6e|%4e)(s|%73|%53)(e|%65|%45)(r|%72|%52)(t|%74|%54)(\\+|%2b|%20) [NC,OR]
	RewriteCond %{QUERY_STRING} (\\+|%2b|%20)(s|%73|%53)(e|%65|%45)(l|%6c|%4c)(e|%65|%45)(c|%63|%43)(t|%74|%54)(\\+|%2b|%20) [NC,OR]
	RewriteCond %{QUERY_STRING} (\\+|%2b|%20)(u|%75|%55)(p|%70|%50)(d|%64|%44)(a|%61|%41)(t|%74|%54)(e|%65|%45)(\\+|%2b|%20) [NC,OR]
	RewriteCond %{QUERY_STRING} (\\\\x00|(\"|%22|\\'|%27)?0(\"|%22|\\'|%27)?(=|%3d)(\"|%22|\\'|%27)?0|cast(\\(|%28)0x|or%201(=|%3d)1) [NC,OR]
	RewriteCond %{QUERY_STRING} (g|%67|%47)(l|%6c|%4c)(o|%6f|%4f)(b|%62|%42)(a|%61|%41)(l|%6c|%4c)(s|%73|%53)(=|\\[|%[0-9A-Z]{0,2}) [NC,OR]
	RewriteCond %{QUERY_STRING} (_|%5f)(r|%72|%52)(e|%65|%45)(q|%71|%51)(u|%75|%55)(e|%65|%45)(s|%73|%53)(t|%74|%54)(=|\\[|%[0-9A-Z]{2,}) [NC,OR]
	RewriteCond %{QUERY_STRING} (j|%6a|%4a)(a|%61|%41)(v|%76|%56)(a|%61|%31)(s|%73|%53)(c|%63|%43)(r|%72|%52)(i|%69|%49)(p|%70|%50)(t|%74|%54)(:|%3a)(.*)(;|%3b|\\)|%29) [NC,OR]
	RewriteCond %{QUERY_STRING} (b|%62|%42)(a|%61|%41)(s|%73|%53)(e|%65|%45)(6|%36)(4|%34)(_|%5f)(e|%65|%45|d|%64|%44)(e|%65|%45|n|%6e|%4e)(c|%63|%43)(o|%6f|%4f)(d|%64|%44)(e|%65|%45)(.*)(\\()(.*)(\\)) [NC,OR]
	RewriteCond %{QUERY_STRING} (@copy|\\$_(files|get|post)|allow_url_(fopen|include)|auto_prepend_file|blexbot|browsersploit|call_user_func_array|(php|web)shell|curl(_exec|test)|disable_functions?|document_root) [NC,OR]
	RewriteCond %{QUERY_STRING} (elastix|encodeuricom|exploit|fclose|fgets|file_put_contents|fputs|fsbuff|fsockopen|gethostbyname|ghost|grablogin|hmei7|hubs_post-cta|input_file|invokefunction|(\\b)load_file|open_basedir|outfile|p3dlite) [NC,OR]
	RewriteCond %{QUERY_STRING} (pass(=|%3d)shell|passthru|phpinfo|phpshells|popen|proc_open|quickbrute|remoteview|root_path|safe_mode|shell_exec|site((.){0,2})copier|sp_executesql|sux0r|trojan|udtudt|user_func_array|wget|wp_insert_user|xertive) [NC,OR]
	RewriteCond %{QUERY_STRING} (;|<|>|\\'|\"|\\)|%0a|%0d|%22|%27|%3c|%3e|%00)(.*)(/*|alter|base64|benchmark|cast|concat|create|encode|declare|delay|delete|drop|hex|insert|load|md5|null|replace|request|script|select|set|sleep|truncate|unhex|update) [NC,OR]
	RewriteCond %{QUERY_STRING} ((\\+|%2b)(concat|delete|get|select|union)(\\+|%2b)) [NC,OR]
	RewriteCond %{QUERY_STRING} (union)(.*)(select)(.*)(\\(|%28) [NC,OR]
	RewriteCond %{QUERY_STRING} (concat|eval)(.*)(\\(|%28) [NC]

	RewriteRule .* - [F]

</IfModule>

# 8G:[REQUEST URI]
<IfModule mod_rewrite.c>

	RewriteCond %{REQUEST_URI} (,,,) [NC,OR]
	RewriteCond %{REQUEST_URI} (-------) [NC,OR]
	RewriteCond %{REQUEST_URI} (\\^|\`|<|>|\\\\|\\|) [NC,OR]
	RewriteCond %{REQUEST_URI} ([a-z0-9]{2000,}) [NC,OR]
	RewriteCond %{REQUEST_URI} (=?\\\\(\\'\\'|%27)/?)(\\.) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(*|\"|\\'\\'|\\.|,|&|&amp;?)?/?$ [NC,OR]
	RewriteCond %{REQUEST_URI} (\\.)(php)(\\()?([0-9]+)(\\))?(/)?$ [NC,OR]
	RewriteCond %{REQUEST_URI} /((.*)header:|(.*)set-cookie:(.*)=) [NC,OR]
	RewriteCond %{REQUEST_URI} (\\.(s?ftp-?)config|(s?ftp-?)config\\.) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)((force-)?download|framework/main)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (\\{0\\}|\\"?0\\"?=\\"?0|\\(/\\(|\\.\\.\\.|\\+\\+\\+|\\\\\\") [NC,OR]
	RewriteCond %{REQUEST_URI} (/)((c99|php|web)?shell|crossdomain|fileditor|locus7|nstview|php(get|remoteview|writer)|r57|remview|sshphp|storm7|webadmin)(.*)(\\.|%2e|\\(|%28) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(vbull(etin)?|boards|vbforum|vbweb|webvb)(/)? [NC,OR]
	RewriteCond %{REQUEST_URI} (\\.|20)(get|the)(_)(permalink|posts_page_url)(\\() [NC,OR]
	RewriteCond %{REQUEST_URI} (///|\\?\\?|/&&|/\\*(.*)*|/:/|\\\\\\\\|0x00|%00|%0d%0a) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(cgi_?)?alfa(_?cgiapi|_?data|_?v[0-9]+)?(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (thumbs?(_editor|open)?|tim(thumbs?)?)((\\.|%2e)php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)((boot)?_?admin(er|istrator|s)(_events)?(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/%7e)(root|ftp|bin|nobody|named|guest|logs|sshd)(/) [NC,OR]
	RewriteCond %{REQUEST_URI} (archive|backup|db|master|sql|wp|www|wwwroot)\\.(gz|zip) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(\\.?mad|alpha|c99|php|web)?sh(3|e)ll([0-9]+|\\w)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(admin-?|file-?)(upload)(bg|_?file|ify|svu|ye)?(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(etc|var)(/)(hidden|secret|shadow|ninja|passwd|tmp)(/)?$ [NC,OR]
	RewriteCond %{REQUEST_URI} (s)?(ftp|http|inurl|php)(s)?(:(/|%2f|%u2215)(/|%2f|%u2215)) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(=|\\$&?|&?(pws|rk)=0|_mm|_vti_|cgi(\\.|-)|(=|/|;|,)nt\\.) [NC,OR]
	RewriteCond %{REQUEST_URI} (\\.)ds_store|htaccess|htpasswd|init?|mysql-select-db)(/)?$ [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(bin)(/)(cc|chmod|chsh|cpp|echo|id|kill|mail|nasm|perl|ping|ps|python|tclsh)(/)?$ [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(::[0-9999]|%3a%3a[0-9999]|127\\.0\\.0\\.1|ccx|localhost|makefile|pingserver|wwwroot)(/)? [NC,OR]
	RewriteCond %{REQUEST_URI} ^(/)(123|backup|bak|beta|bkp|default|demo|dev(new|old)?|new-?site|null|old|old_files|old1)(/)?$ [NC,OR]
	RewriteCond %{REQUEST_URI} (/)?j((\\s)+)?a((\\s)+)?v((\\s)+)?a((\\s)+)?s((\\s)+)?c((\\s)+)?r((\\s)+)?i((\\s)+)?p((\\s)+)?t((\\s)+)?(%3a|:) [NC,OR]
	RewriteCond %{REQUEST_URI} ^(/)(old-?site(back)?|old(web)?site(here)?|sites?|staging|undefined|wordpress([0-9]+)|wordpress-old)(/)?$ [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(filemanager|htdocs|httpdocs|https?|mailman|mailto|msoffice|undefined|usage|var|vhosts|webmaster|www)(/) [NC,OR]
	RewriteCond %{REQUEST_URI} (\\(null\\)|\\{\\$itemURL\\}|cast\\(0x|echo(.*)kae|etc/passwd|eval\\(|null(.*)null|open_basedir|self/environ|\\+union\\+all\\+select) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(db-?|j-?|my(sql)?-?|setup-?|web-?|wp-?)?(admin-?)?(setup-?)?(conf\\b|conf(ig)?)(uration)?(\\.?bak|\\.inc)?(\\.inc|\\.old|\\.php|\\.txt) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)((.*)crlf-?injection|(.*)xss-?protection|__(inc|jsc)|author-panel|cgi-bin|database|downloader|(db|mysql)-?admin)(/) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(haders|head|hello|helpear|incahe|includes?|indo(sec)?|infos?|ioptimizes?|jmail|js|king|kiss|kodox|kro|legion|libsoft)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(awstats|document_root|dologin\\.action|error.log|extension/ext|htaccess\\.|lib/php|listinfo|phpunit/php|remoteview|server/php|www\\.root\\.) [NC,OR]
	RewriteCond %{REQUEST_URI} (base64_(en|de)code|benchmark|curl_exec|e?chr|eval|function|fwrite|(f|p)open|html|leak|passthru|p?fsockopen|phpinfo)(.*)(\\(|%28)(.*)(\\)|%29) [NC,OR]
	RewriteCond %{REQUEST_URI} (posix_(kill|mkfifo|setpgid|setsid|setuid)|(child|proc)_(close|get_status|nice|open|terminate)|(shell_)?exec|system)(.*)(\\(|%28)(.*)(\\)|%29) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(f?ckfinder|fck/|fckeditor|fullclick) [NC,OR]
	RewriteCond %{REQUEST_URI} /((wp-)((201\\d|202\\d|[0-9]{2})|ad|admin(fx|rss|setup)|booking|confirm|crons|data|file|mail|one|plugins?|readindex|reset|setups?|story))(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(^$|-|\\!|\\w|\\.(.*)|100|123|([^iI])?ndex|index\\.php/index|3xp|777|7yn|90sec|99|active|aill|ajs\\.delivery|al277|alexuse?|ali|allwrite)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(analyser|apache|apikey|apismtp|authenticat(e|ing)|autoload_classmap|backup(_index)?|bakup|bkht|black|bogel|bookmark|bypass|cachee?)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(clean|cm(d|s)|con|connector\\.minimal|contexmini|contral|curl(test)?|data(base)?|db|db-cache|db-safe-mode|defau11|defau1t|dompdf|dst)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(elements|emails?|error.log|ecscache|edit-form|eval-stdin|evil|fbrrchive|filemga|filenetworks?|f0x|gank(\\.php)?|gass|gel|guide)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(logo_img|lufix|mage|marg|mass|mide|moon|mssqli|mybak|myshe|mysql|mytag_js?|nasgor|newfile|news|nf_?tracking|nginx|ngoi|ohayo|old-?index)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(olux|owl|pekok|petx|php-?info|phpping|popup-pomo|priv|r3x|radio|rahma|randominit|readindex|readmy|reads|repair-?bak|robot(s\\.txt)?|root)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(router|savepng|semayan|shell|shootme|sky|socket(c|i|iasrgasf)ontrol|sql(bak|_?dump)?|support|sym403|sys|system_log|test|tmp-?(uploads)?)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(traffic-advice|u2p|udd|ukauka|up__uzegp|up14|upa?|upxx?|vega|vip|vu(ln)?(\\w)?|webroot|weki|wikindex|wordpress|wp_logns?|wp_wrong_datlib)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (/)(wp-?install|installation|wp(3|4|5|6)|wpfootes|wpzip|ws0|wsdl|wso(\\w)?|www|(uploads|wp-admin)?xleet(-shell)?|xmlsrpc|xup|xxu|xxx|zibi|zipy)(\\.php) [NC,OR]
	RewriteCond %{REQUEST_URI} (bkv74|cachedsimilar|core-stab|crgrvnkb|ctivrc|deadcode|deathshop|dkiz|e7xue|eqxafaj90zir|exploits|ffmkpcal|filellli7|(fox|sid)wso|gel4y|goog1es|gvqqpinc) [NC,OR]
	RewriteCond %{REQUEST_URI} (@md5|00.temp00|0byte|0d4y|0day|0xor|wso1337|1h6j5|3xp|40dd1d|4price|70bex?|a57bze893|abbrevsprl|abruzi|adminer|aqbmkwwx|archivarix|backdoor|beez5|bgvzc29) [NC,OR]
	RewriteCond %{REQUEST_URI} (handler_to_code|hax(0|o)r|hmei7|hnap1|home_url=|ibqyiove|icxbsx|indoxploi|jahat|jijle3|kcrew|keywordspy|laobiao|lock360|longdog|marijuan|mod_(aratic|ariimag)) [NC,OR]
	RewriteCond %{REQUEST_URI} (mobiquo|muiebl|nessus|osbxamip|phpunit|priv8|qcmpecgy|r3vn330|racrew|raiz0|reportserver|r00t|respectmus|rom2823|roseleif|sh3ll|site((.){0,2})copier|sqlpatch|sux0r) [NC,OR]
	RewriteCond %{REQUEST_URI} (sym403|telerik|uddatasql|utchiha|visualfrontend|w0rm|wangdafa|wpyii2|wsoyanzo|x5cv|xattack|xbaner|xertive|xiaolei|xltavrat|xorz|xsamxad|xsvip|xxxs?s?|zabbix|zebda) [NC,OR]
	RewriteCond %{REQUEST_URI} (\\.)7z|ab4|ace|afm|alfa|as(h|m)x?|aspx?|aws|axd|bash|ba?k?|bat|bz2|cfg|cfml?|cgi|cms|conf\\b|config|ctl|dat|db|dist|dll|eml|eng(ine)?|env|et2|exe|fec|fla|git(ignore)?)$ [NC,OR]
	RewriteCond %{REQUEST_URI} (\\.)hg|idea|inc|index|ini|inv|jar|jspa?|lib|local|log|lqd|make|mbf|mdb|mmw|mny|mod(ule)?|msi|old|one|orig|out|passwd|pdb|php\\.(php|suspect(ed)?)|php([^\\/])|phtml?|pl|profiles?)$ [NC,OR]
	RewriteCond %{REQUEST_URI} (\\.)psd|pst|ptdb|production|pwd|py|qbb|qdf|rar|rdf|remote|save|sdb|sql|sh|soa|svn|swf|swl|swo|swp|stx|tar|tax|tgz?|theme|tls|tmb|tmd|wok|wow|xsd|xtmpl|xz|ya?ml|za|zlib)$ [NC]

	RewriteRule .* - [F]

</IfModule>

# 8G:[USER AGENT]
<IfModule mod_rewrite.c>

	RewriteCond %{HTTP_USER_AGENT} ([a-z0-9]{2000,}) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (&lt;|%0a|%0d|%27|%3c|%3e|%00|0x00|\\\\x22) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (ahrefs|archiver|curl|libwww-perl|pycurl|scan) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (oppo\\sa33|(c99|php|web)shell|site((.){0,2})copier) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (base64_decode|bin/bash|disconnect|eval|unserializ) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (acapbot|acoonbot|alexibot|asterias|attackbot|awario|backdor|becomebot|binlar|blackwidow|blekkobot|blex|blowfish|bullseye|bunnys|butterfly|careerbot|casper|censysinspect) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (checkpriv|cheesebot|cherrypick|chinaclaw|choppy|claudebot|clshttp|cmsworld|copernic|copyrightcheck|cosmos|crawlergo|crescent|datacha|(\\b)demon(\\b)|diavol|discobot|dittospyder) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (dotbot|dotnetdotcom|dumbot|econtext|emailcollector|emailsiphon|emailwolf|eolasbot|eventures|extract|eyenetie|feedfinder|flaming|flashget|flicky|foobot|fuck) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (g00g1e|getright|gigabot|go-ahead-got|gozilla|grabnet|grafula|harvest|heritrix|httracks?|icarus6j|imagesiftbot|jetbot|jetcar|jikespider|kmccrew|leechftp|libweb|liebaofast) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (linkscan|linkwalker|lwp-download|majestic|masscan|mauibot|miner|mechanize|mj12bot|morfeus|moveoverbot|mozlila|nbot|netmechanic|netspider|nicerspro|nikto|ninja|nominet|nutch) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (octopus|pagegrabber|petalbot|planetwork|postrank|proximic|purebot|queryn|queryseeker|radian6|radiation|realdownload|remoteview|rogerbot|scan|scooter|seekerspid) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (semalt|siclab|sindice|sistrix|sitebot|siteexplorer|sitesnagger|skygrid|smartdownload|snoopy|sosospider|spankbot|spbot|sqlmap|stackrambler|stripper|sucker|surftbot) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (sux0r|suzukacz|suzuran|takeout|teleport|telesoft|true_robots|turingos|turnit|vampire|vikspider|voideye|webleacher|webreaper|webstripper|webvac|webviewer|webwhacker) [NC,OR]
	RewriteCond %{HTTP_USER_AGENT} (winhttp|wwwoffle|woxbot|xaldon|xxxyy|yamanalab|yioopbot|youda|zeus|zmeu|zune|zyborg) [NC]

	RewriteRule .* - [F]

</IfModule>

# 8G:[REMOTE HOST]
<IfModule mod_rewrite.c>

	RewriteCond %{REMOTE_HOST} (163data|amazonaws|colocrossing|crimea|g00g1e|justhost|kanagawa|loopia|masterhost|onlinehome|poneytel|sprintdatacenter|reverse.softlayer|safenet|ttnet|woodpecker|wowrack) [NC]

	RewriteRule .* - [F]

</IfModule>

# 8G:[HTTP REFERRER]
<IfModule mod_rewrite.c>

	RewriteCond %{HTTP_REFERER} (order(\\s|%20)by(\\s|%20)1--) [NC,OR]
	RewriteCond %{HTTP_REFERER} (@unlink|assert\\(|print_r\\(|x00|xbshell) [NC,OR]
	RewriteCond %{HTTP_REFERER} (100dollars|best-seo|blue\\spill|cocaine|ejaculat|erectile|erections|hoodia|huronriveracres|impotence|levitra|libido|lipitor|mopub\\.com|phentermin) [NC,OR]
	RewriteCond %{HTTP_REFERER} (pornhelm|pro[sz]ac|sandyauer|semalt\\.com|social-buttions|todaperfeita|tramadol|troyhamby|ultram|unicauca|valium|viagra|vicodin|xanax|ypxaieo) [NC]

	RewriteRule .* - [F]

</IfModule>

# 8G:[HTTP COOKIE]
<IfModule mod_rewrite.c>

	RewriteCond %{HTTP_COOKIE} (<|>|\\'|%0A|%0D|%27|%3C|%3E|%00) [NC]

	RewriteRule .* - [F]

</IfModule>

# 8G:[REQUEST METHOD]
<IfModule mod_rewrite.c>

	RewriteCond %{REQUEST_METHOD} ^(connect|debug|move|trace|track) [NC]

	RewriteRule .* - [F]

</IfModule>`
    }
  }

  // Handle htaccess content changes while preserving cursor position
  const handleHtaccessChange = useCallback((e) => {
    const newValue = e.target.value
    const cursorPosition = e.target.selectionStart
    
    setHtaccessContent(newValue)
    
    // Restore cursor position after state update
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  }, [])

  // Insert htaccess rule snippets
  const insertHtaccessRule = useCallback((rule) => {
    if (!textareaRef.current) return
    
    const textarea = textareaRef.current
    const currentContent = htaccessContent
    
    // Always insert at the bottom of the file
    let ruleToInsert = rule
    
    // Ensure proper spacing before the rule if file isn't empty
    if (currentContent.length > 0) {
      // Add newlines to separate from existing content
      if (!currentContent.endsWith('\n')) {
        ruleToInsert = '\n' + ruleToInsert
      }
      // Add an extra newline for better separation
      if (!currentContent.endsWith('\n\n')) {
        ruleToInsert = '\n' + ruleToInsert
      }
    }
    
    // Always add an empty line after the rule for organization
    ruleToInsert += '\n'
    
    const newContent = currentContent + ruleToInsert
    const newCursorPosition = newContent.length
    
    setHtaccessContent(newContent)
    
    // Focus and position cursor at the end after the inserted rule
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPosition, newCursorPosition)
      // Scroll to bottom to show the newly inserted rule
      textarea.scrollTop = textarea.scrollHeight
    })
     }, [htaccessContent])

  const loadSecurityData = async () => {
    if (!adminData?.restUrl) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`${adminData.restUrl}security-data`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })

      if (response.ok) {
        const json = await response.json()
        console.log('Security data response:', json)
        if (json.success && json.data && Object.keys(json.data).length > 0) {
          setSecurityData(json.data)
          setHasData(true)
        } else {
          console.log('No security data found or empty response')
          setHasData(false)
        }
      } else {
        console.log('Security data request failed:', response.status)
        setHasData(false)
      }
    } catch (error) {
      console.error('Failed to load security data:', error)
      setHasData(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSecurityData()
  }, [adminData?.restUrl])

  const requestSecurityScan = () => {
    setIsGeneratingData(true)
    
    const securityScanMessage = `Please perform a comprehensive security analysis of my WordPress website. I need you to:

1. **Security Audit**: Use security_audit to check for common WordPress security misconfigurations
2. **Core Checksum Verification**: Use security_core_checksum to verify WordPress core files haven't been tampered with
3. **Plugin Security Check**: Use security_plugins_checksum to check plugin file integrity 
4. **Theme Security Check**: Use security_themes_checksum to verify theme file integrity
5. **File Permissions Check**: Use security_file_permissions to identify dangerous file permissions
6. **HTTP Security Headers**: Use security_http_headers to verify HTTP security headers are properly configured
7. **HTTPS Enforcement**: Use security_https_enforcement to check SSL/TLS configuration
8. **PHP Version Check**: Use security_php_version_check to verify PHP version security
9. **Admin Users Audit**: Use security_admin_users_audit to review administrator accounts
10. **Login Events**: Use security_login_events to analyze recent login activity
11. **File Integrity Monitoring**: Use security_file_integrity_watch to establish baseline for ongoing monitoring
12. **Wordfence Vulnerability Scan**: Use security_vulnerability_scan to check for known vulnerabilities using the free Wordfence Intelligence database
13. **htaccess Protection**: Use security_htaccess_protection to verify htaccess security rules

Please provide actionable security recommendations and highlight any critical issues that need immediate attention.`

    sessionStorage.setItem('mat_prefill_message', securityScanMessage)
    window.dispatchEvent(new CustomEvent('mat_switch_tab', { detail: { tab: 'chat' } }))
    
    setTimeout(() => {
      setIsGeneratingData(false)
    }, 1000)
  }

  const generateSampleData = async () => {
    if (!adminData?.restUrl) {
      showError('Unable to connect to WordPress API')
      return
    }

    setIsGeneratingData(true)

    try {
      const sampleData = {
        security_core_checksum: {
          success: true,
          verified_count: 1247,
          missing: ['wp-content/themes/twentytwentyfive/style.css'],
          modified: [],
          checksum_report: { verified: 1247, missing: 1, modified: 0, completion_rate: 99.9 }
        },
        security_audit: {
          success: true,
          overall_score: 82,
          checks: [
            { check: 'User Registration', status: 'ok', message: 'Public registration disabled', recommendation: null },
            { check: 'Admin User', status: 'warning', message: 'Default "admin" username exists', recommendation: 'Consider renaming the admin user' }
          ]
        },
        security_file_permissions: {
          success: true,
          total_files: 3247,
          critical_issues: 2,
          report: { secure_files: 3245, critical: 2 },
          issues: [
            { path: '/wp-config.php', current_permissions: '644', recommended_permissions: '600', severity: 'critical', risk: 'Configuration file readable by others' }
          ]
        },
        security_headers: {
          success: true,
          security_score: 67,
          headers: {
            'X-Content-Type-Options': { present: true, value: 'nosniff', status: 'good' },
            'Strict-Transport-Security': { present: false, status: 'missing', recommendation: 'Enable HTTPS and add HSTS header' }
          }
        },
        lastUpdated: new Date().toISOString()
      }

      const response = await fetch(`${adminData.restUrl}security-data`, {
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
          setSecurityData(sampleData)
          setHasData(true)
          showSuccess('Sample security data loaded successfully!')
        }
      }
    } catch (error) {
      console.error('Failed to generate sample security data:', error)
      showError('Failed to generate sample security data. Please try again.')
    } finally {
      setIsGeneratingData(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'ok': case 'good': case 'verified': return 'success'
      case 'warning': case 'moderate': return 'warning'
      case 'critical': case 'error': case 'missing': return 'failure'
      default: return 'gray'
    }
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const EmptyState = () => (
    <div className="max-w-md mx-auto text-center py-12">
      <div className="mb-8">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900 mb-4">
          <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Security Data Available
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Get comprehensive security insights for your WordPress website using our AI-powered security analysis tools.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border border-red-200 dark:border-red-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">🔒 Real Security Analysis</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Let our AI perform comprehensive security checks including core file integrity, plugin security, permissions audit, and security headers analysis.
          </p>
          <Button
            onClick={requestSecurityScan}
            disabled={isGeneratingData}
            className="w-full bg-red-600 hover:bg-red-700 focus:ring-red-500"
          >
            {isGeneratingData ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Start Security Analysis
              </>
            )}
          </Button>
        </div>

        <div className="text-gray-500 dark:text-gray-400 text-sm font-medium">OR</div>

        <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">📊 View Sample Data</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Explore the security analytics interface with sample data to see what insights you'll get.
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
            💡 <strong>Tip:</strong> Regular security analysis helps identify vulnerabilities, file integrity issues, and security misconfigurations before they become threats.
          </p>
        </div>
      )}
    </div>
  )

  const DataView = useMemo(() => {
    // Normalize various API response shapes to handle both legacy and new keys

    // --- Security Audit ---
    const auditData = securityData?.security_audit || {}
    const showTips = settings?.show_tips !== false
    const auditSummary = auditData.summary || {}
    const auditChecks = auditData.audit_results || auditData.checks || []

    const auditScore = auditSummary.security_score || auditSummary.overall_score || auditData.overall_score || 0

    // --- Core Checksum ---
    const coreChecksumRaw = securityData?.security_core_checksum || {}
    const coreChecksum = coreChecksumRaw.checksum_report || coreChecksumRaw
    const coreVerified = coreChecksum.verified || coreChecksum.verified_count || coreChecksum.files_verified || 0
    const rawMissing = coreChecksum.missing_files ?? coreChecksum.missing ?? []
    const coreMissing = Array.isArray(rawMissing) ? rawMissing.length : Number(rawMissing) || 0
    const rawModified = coreChecksum.modified_files ?? coreChecksum.modified ?? []
    const coreModified = Array.isArray(rawModified) ? rawModified.length : Number(rawModified) || 0

    // --- Plugins Checksum ---
    const rawPlugins = securityData?.security_plugins_checksum?.plugins || securityData?.security_plugins_checksum?.plugins_report || {}
    const pluginsArray = Array.isArray(rawPlugins) ? rawPlugins : Object.entries(rawPlugins).map(([slug, info]) => ({ slug, ...info, name: info.name || slug }))

    // --- Themes Checksum ---
    const rawThemes = securityData?.security_themes_checksum?.themes || securityData?.security_themes_checksum?.themes_report || {}
    const themesArray = Array.isArray(rawThemes) ? rawThemes : Object.entries(rawThemes).map(([slug, info]) => ({ slug, ...info, name: info.name || slug }))

    // --- File Permissions ---
    const filePermsRaw = securityData?.security_file_permissions || {}
    const filePerms = filePermsRaw.report || filePermsRaw
    // Derive counts when not explicitly provided
    const totalFilesScanned = filePerms.total_items_scanned || filePerms.total_files || 0
    const criticalPermIssues = filePerms.critical_issues || filePerms.critical || 0
    const warningsPermIssues = filePerms.warnings || filePerms.items_with_warnings || Math.max((filePerms.items_with_issues || 0) - criticalPermIssues, 0)
    const secureFilesCount = filePerms.secure_files || Math.max(totalFilesScanned - (filePerms.items_with_issues || 0), 0)

    // --- Headers Report ---
    const headersReport = (securityData?.security_http_headers?.headers_report) || (securityData?.security_headers?.headers_report) || (securityData?.security_http_headers?.headers) || (securityData?.security_headers?.headers) || {}

    // Calculate Security Headers score. If API provided score is missing or zero, compute based on headersReport
    let headerScore = securityData?.security_http_headers?.security_score ?? securityData?.security_headers?.security_score

    // Fallback: derive score from the report if not supplied (or zero)
    if ((headerScore === undefined || headerScore === null || headerScore === 0) && Object.keys(headersReport).length > 0) {
      const totalHeaders = Object.keys(headersReport).length
      let passed = 0

      Object.values(headersReport).forEach((h) => {
        // Determine if header is effectively present / passes the check
        const status = (h.status || '').toString().toLowerCase()
        const present = h.present !== undefined ? h.present : (status === 'ok' || status === 'good' || status === 'present')
        if (present) passed += 1
      })

      headerScore = Math.round((passed / totalHeaders) * 100)
    }

    // --- HTTPS Enforcement ---
    const httpsReport = securityData?.security_https_enforcement?.https_report || securityData?.security_https_enforcement || {}

    // --- PHP Version ---
    const phpReport = securityData?.security_php_version_check?.php_report || securityData?.security_php_version_check || {}

    // --- Admin Users ---
    const adminUsers = securityData?.security_admin_users_audit?.administrators || securityData?.security_admin_users_audit?.admin_users || []

    // --- Login Events ---
    const loginRaw = securityData?.security_login_events || {}
    const loginEvents = loginRaw.events || loginRaw.recent_events || []
    let loginLastChecked = loginRaw.last_updated || loginRaw.lastUpdated || loginRaw.last_check || securityData?.lastUpdated || null
    if (typeof loginLastChecked === 'number' && loginLastChecked < 1e12) {
      loginLastChecked = loginLastChecked * 1000 // convert seconds to ms
    }

    // Aggregate events by user to compute last login & failed attempts
    const loginSummaryMap = {}
    loginEvents.forEach((ev) => {
      const username = ev.user || ev.username || ev.user_login || ev.login || 'unknown'
      if (!username) return
      if (!loginSummaryMap[username]) {
        loginSummaryMap[username] = {
          username,
          lastLogin: null,
          failedAttempts: 0,
        }
      }
      let ts = ev.timestamp ?? ev.time ?? ev.date ?? null
      if (typeof ts === 'number' && ts < 1e12) ts = ts * 1000
      const type = (ev.type || ev.status || '').toString().toLowerCase()
      if (type === 'success' || type === 'ok') {
        if (ts && (!loginSummaryMap[username].lastLogin || ts > loginSummaryMap[username].lastLogin)) {
          loginSummaryMap[username].lastLogin = ts
        }
      } else if (type === 'failure' || type === 'failed' || type === 'error') {
        loginSummaryMap[username].failedAttempts += 1
      }
    })

    // Finalize summary objects with status label based on failed attempts
    Object.values(loginSummaryMap).forEach((s) => {
      s.status = s.failedAttempts > 0 ? 'warning' : 'ok'
    })

    const loginSummaries = Object.values(loginSummaryMap).sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0))

    // --- File Integrity Watch ---
    const integrityRaw = securityData?.security_file_integrity_watch || {}
    const integrityReport = integrityRaw.integrity_report || integrityRaw
    const filesMonitored = integrityReport.files_monitored || integrityReport.total_monitored_files || 0
    const monitoringStatus = integrityReport.status || (filesMonitored > 0 ? 'monitoring' : 'inactive')
    const integrityLastScan = integrityReport.last_scan || integrityReport.last_updated || null

    // --- Vulnerability Scan ---
    const vulnScan = securityData?.security_vulnerability_scan || {}

    // --- htaccess ---
    const htaccessReport = securityData?.security_htaccess_protection?.htaccess_report || {}
    const htaccessRulesStatus = htaccessReport.checks ? Object.entries(htaccessReport.checks).map(([name, present]) => ({ name, present })) : securityData?.security_htaccess_protection?.rules || []

    const criticalIssues = filePerms.critical_issues || filePerms.critical || 0

    const navigateToSection = (ref) => {
      if (ref?.current) {
        const HEADER_OFFSET = 120 // adjust to header height (px)
        const y = ref.current.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET
        window.scrollTo({ top: y, behavior: 'smooth' })
      }
      setShowCriticalModal(false)
    }

    // Open .htaccess editor modal and load content
    const openHtaccessEditor = async () => {
      setHtaccessLoading(true)
      try {
        // First, load the current .htaccess content
        const response = await fetch(`${adminData.restUrl}htaccess`, {
          headers: { 'X-WP-Nonce': adminData.nonces.wp_rest }
        })
        
        if (response.ok) {
          const json = await response.json()
          if (json.success) {
            const currentContent = json.content
            
            // Create a backup before opening the editor
            if (currentContent && currentContent.trim()) {
              try {
                const backupResponse = await fetch(`${adminData.restUrl}htaccess-backup`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': adminData.nonces.wp_rest
                  },
                  body: JSON.stringify({ 
                    content: currentContent,
                    timestamp: new Date().toISOString()
                  })
                })
                
                if (backupResponse.ok) {
                  const backupResult = await backupResponse.json()
                  if (backupResult.success) {
                    showSuccess('Current .htaccess backed up successfully')
                  }
                }
              } catch (backupError) {
                console.warn('Failed to create backup:', backupError)
                // Don't block the editor from opening if backup fails
              }
            }
            
            setHtaccessContent(currentContent)
          } else {
            showError('Failed to load .htaccess content')
          }
        } else {
          showError('Failed to load .htaccess content')
        }
      } catch (error) {
        console.error('Failed to load .htaccess:', error)
        showError('Error loading .htaccess content')
      } finally {
        setHtaccessLoading(false)
        setShowHtaccessEditor(true)
      }
    }

    // Save .htaccess content
    const saveHtaccess = async () => {
      setHtaccessSaving(true)
      try {
        const response = await fetch(`${adminData.restUrl}htaccess`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': adminData.nonces.wp_rest
          },
          body: JSON.stringify({ content: htaccessContent })
        })
        if (response.ok) {
          const json = await response.json()
          if (json.success) {
            showSuccess('.htaccess file saved successfully')
            setShowHtaccessEditor(false)
          } else {
            showError('Failed to save .htaccess content')
          }
        } else {
          showError('Failed to save .htaccess content')
        }
      } catch (error) {
        console.error('Failed to save .htaccess:', error)
        showError('Error saving .htaccess content')
      } finally {
        setHtaccessSaving(false)
      }
    }

    // AI suggestion for .htaccess
    const suggestHtaccessCode = () => {
      const prompt = 'Please provide the exact Apache .htaccess code needed to secure my WordPress installation by implementing common hardening rules including denial of direct access to sensitive files and disabling directory browsing.'
      sessionStorage.setItem('mat_prefill_message', prompt)
      window.dispatchEvent(new CustomEvent('mat_switch_tab', { detail: { tab: 'chat' } }))
    }

    return (
      <div className="space-y-6">
        {/* Security Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${auditScore >= 80 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <svg className={`w-6 h-6 ${getScoreColor(auditScore)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Security Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(auditScore)}`}>
                  {auditScore}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${criticalIssues === 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <svg className={`w-6 h-6 ${criticalIssues === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Critical Issues</p>
                <p className={`text-2xl font-bold ${criticalIssues === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {criticalIssues}
                </p>
                {criticalIssues > 0 && (
                  <button 
                    onClick={() => setShowCriticalModal(true)}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline mt-1"
                  >
                    View Details
                  </button>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${headerScore >= 80 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                <svg className={`w-6 h-6 ${getScoreColor(headerScore)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Header Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(headerScore)}`}>
                  {headerScore}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Last Scan</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {securityData?.lastUpdated ? new Date(securityData.lastUpdated).toLocaleDateString() : 'Never'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Security Audit Results */}
        {securityData?.security_audit && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🔍 Security Configuration Audit
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {auditChecks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Badge color={getStatusColor(check.status)}>{check.status}</Badge>
                      <h4 className="font-medium text-gray-900 dark:text-white">{check.check}</h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{check.message}</p>
                    {check.recommendation && showTips && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        💡 {check.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Core File Integrity */}
        {securityData?.security_core_checksum && (
          <div ref={coreSectionRef}>
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🛡️ WordPress Core Integrity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {coreVerified}
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">Verified Files</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                  {coreMissing}
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">Missing Files</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
                  {coreModified}
                </p>
                <p className="text-sm text-red-800 dark:text-red-200">Modified Files</p>
              </div>
            </div>
            
            {/* Missing Files Alert */}
            {((coreChecksum.missing && coreChecksum.missing.length > 0) || (coreChecksum.missing_files && coreChecksum.missing_files.length > 0)) && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Missing Core Files (Safe to Ignore):</h4>
                <div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                  {(coreChecksum.missing || coreChecksum.missing_files || []).slice(0, 5).map((file, index) => (
                    <p key={index}>• {file}</p>
                  ))}
                  {((coreChecksum.missing || coreChecksum.missing_files || []).length > 5) && (
                    <p>... and {(coreChecksum.missing || coreChecksum.missing_files || []).length - 5} more files</p>
                  )}
                </div>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  These are typically default themes and plugins that were safely removed.
                </p>
              </div>
            )}

            {/* Modified Files Alert */}
            {((coreChecksum.modified && coreChecksum.modified.length > 0) || (coreChecksum.modified_files && coreChecksum.modified_files.length > 0)) && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">⚠️ Modified Core Files (Requires Investigation):</h4>
                <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
                  {(coreChecksum.modified || coreChecksum.modified_files || []).map((file, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <span>{file}</span>
                      <button onClick={() => navigateToSection(coreSectionRef)} className="text-xs text-blue-600 hover:underline">View section ↗</button>
                    </li>
                  ))}
                </div>
              </div>
            )}
          </Card>
          </div>
        )}

        {/* Plugin Security Status */}
        {securityData?.security_plugins_checksum && (
          <div ref={pluginSectionRef}>
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🔌 Plugin Security Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-center">
              {pluginsArray.map((plugin, index) => (
                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex flex-col h-full">
                  <div className="flex items-center gap-3">
                    <Badge color={getStatusColor(plugin.status)}>{plugin.status}</Badge>
                    <h4 className="font-medium text-gray-900 dark:text-white">{plugin.name}</h4>
                  </div>
                  <div className="flex-grow">
                    {(plugin.files_checked || plugin.issues || plugin.modified_files || plugin.missing_files) && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {(plugin.files_checked || plugin.files_checked_count || plugin.total_files || 'N/A')} files checked • {(plugin.issues || (plugin.modified_files ? plugin.modified_files.length : 0) + (plugin.missing_files ? plugin.missing_files.length : 0))} issues
                      </p>
                    )}
                  </div>
                  {plugin.modified_files && plugin.modified_files.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700">
                      <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">Modified Files:</p>
                      {plugin.modified_files.map((file, fileIndex) => (
                        <p key={fileIndex} className="text-xs text-yellow-700 dark:text-yellow-300">• {file}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
          </div>
        )}

        {/* Theme Security Status */}
        {securityData?.security_themes_checksum && (
          <div ref={themeSectionRef}>
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🎨 Theme Security Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {themesArray.map((theme, index) => (
                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex flex-col h-full">
                  <div className="flex items-center gap-3">
                    <Badge color={getStatusColor(theme.status)}>{theme.status}</Badge>
                    <h4 className="font-medium text-gray-900 dark:text-white">{theme.name}</h4>
                  </div>
                  <div className="flex-grow">
                    {(theme.files_checked || theme.issues || theme.modified_files || theme.missing_files) && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {(theme.files_checked || theme.total_files || 'N/A')} files checked • {(theme.issues || (theme.modified_files ? theme.modified_files.length : 0) + (theme.missing_files ? theme.missing_files.length : 0))} issues
                      </p>
                    )}
                  </div>
                  {theme.modified_files && theme.modified_files.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700">
                      <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">Modified Files:</p>
                      {theme.modified_files.map((file, fileIndex) => (
                        <p key={fileIndex} className="text-xs text-yellow-700 dark:text-yellow-300">• {file}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
          </div>
        )}

        {/* File Permissions Issues */}
        {securityData?.security_file_permissions && (
          <div ref={filePermSectionRef}>
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              📁 File Permissions Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {secureFilesCount}
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">Secure Files</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                  {warningsPermIssues}
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">Warnings</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
                  {criticalPermIssues}
                </p>
                <p className="text-sm text-red-800 dark:text-red-200">Critical Issues</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {totalFilesScanned}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Files</p>
              </div>
            </div>

            {filePermsRaw?.issues && filePermsRaw.issues.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">Critical Permission Issues:</h4>
                {filePermsRaw.issues.map((issue, index) => (
                  <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge color={issue.severity === 'critical' ? 'failure' : 'warning'}>
                            {issue.severity}
                          </Badge>
                          <code className="text-sm font-mono text-gray-800 dark:text-gray-200">{issue.path}</code>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Current: <code>{issue.current_permissions}</code> → Recommended: <code>{issue.recommended_permissions}</code>
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          Risk: {issue.risk}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              criticalIssues > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">Critical Permission Issues:</h4>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{criticalIssues} critical file permission issues detected.</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Detailed paths were not provided in the report.</p>
                  </div>
                </div>
              )
            )}
          </Card>
          </div>
        )}

        {/* Security Headers */}
        {(securityData?.security_http_headers || securityData?.security_headers) && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🌐 HTTP Security Headers
            </h3>
            <div className="mb-4 text-center">
              <p className={`text-3xl font-bold ${getScoreColor(headerScore)} mb-2`}>
                {headerScore}/100
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Security Headers Score</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {Object.entries(headersReport).map(([header, data]) => (
                <div key={header} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex flex-col h-full">
                  <div className="flex items-center gap-3">
                    <Badge color={getStatusColor(data.status || (data.present ? 'ok' : 'missing'))}>{data.present !== undefined ? (data.present ? 'Present' : 'Missing') : (data.status || 'Unknown')}</Badge>
                    <h4 className="font-medium text-gray-900 dark:text-white">{header}</h4>
                  </div>
                  <div className="flex-grow">
                    {data.value && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Value: <code>{data.value}</code>
                      </p>
                    )}
                  </div>
                  {data.recommendation && showTips && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                      💡 {data.recommendation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* HTTPS Enforcement */}
        {securityData?.security_https_enforcement && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🔒 HTTPS/SSL Configuration
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge color={getStatusColor(httpsReport.enforced ? 'ok' : 'warning')}>
                    {httpsReport.enforced ? 'Enforced' : 'Not Enforced'}
                  </Badge>
                  <h4 className="font-medium text-gray-900 dark:text-white">HTTPS Enforcement</h4>
                </div>
                {httpsReport.issues && httpsReport.issues.map((issue, index) => (
                  <p key={index} className="text-sm text-yellow-600 dark:text-yellow-400">• {issue}</p>
                ))}
                {httpsReport.recommendations && showTips && httpsReport.recommendations.map((rec, index) => (
                  <p key={index} className="text-sm text-blue-600 dark:text-blue-400">💡 {rec}</p>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* PHP Version Check */}
        {securityData?.security_php_version_check && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🐘 PHP Version Security
            </h3>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Badge color={getStatusColor(phpReport.status || 'warning')}>
                  {phpReport.status === 'ok' ? 'Supported' : 'Upgrade Needed'}
                </Badge>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  PHP {phpReport.version || phpReport.current_version}
                </h4>
              </div>
              {phpReport.recommendation && showTips && (
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  💡 {phpReport.recommendation}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Admin Users Audit */}
        {securityData?.security_admin_users_audit && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              👥 Administrator Accounts
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {adminUsers.map((user, index) => (
                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex flex-col h-full">
                  <div className="flex items-center gap-3">
                    <Badge color={getStatusColor(user.risk_level === 'low' ? 'ok' : 'warning')}>
                      {user.risk_level || (user.dormant ? 'dormant' : 'active')}
                    </Badge>
                    <h4 className="font-medium text-gray-900 dark:text-white">{user.username || user.user_login}</h4>
                  </div>
                  {(() => {
                    const pieces = []
                    if (user.email) pieces.push(`Email: ${user.email}`)
                    if (user.last_login) {
                      let ts = user.last_login
                      if (typeof ts === 'number' && ts < 1e12) ts = ts * 1000
                      pieces.push(`Last Login: ${new Date(ts).toLocaleString()}`)
                    } else {
                      pieces.push('Last Login: Never')
                    }
                    return (
                      <p className="text-sm text-gray-600 dark:text-gray-400 flex-grow">
                        {pieces.join(' • ')}
                      </p>
                    )
                  })()}
                  {user.concerns && user.concerns.map((concern, concernIndex) => (
                    <p key={concernIndex} className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">⚠️ {concern}</p>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Login Events */}
        {securityData?.security_login_events && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🔐 Recent Login Activity
            </h3>
            {loginLastChecked && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Last Checked: {new Date(loginLastChecked).toLocaleString()}
              </p>
            )}
            <div className="space-y-3">
              {loginSummaries.slice(0, 10).map((summary, index) => (
                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3 mb-1">
                    <Badge color={getStatusColor(summary.status)}>{summary.failedAttempts > 0 ? 'Warning' : 'OK'}</Badge>
                    <h4 className="font-medium text-gray-900 dark:text-white">{summary.username}</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last Login: {summary.lastLogin ? new Date(summary.lastLogin).toLocaleString() : 'Never'} • Failed Attempts: {summary.failedAttempts}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* File Integrity Monitoring */}
        {securityData?.security_file_integrity_watch && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              📊 File Integrity Monitoring
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {filesMonitored}
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">Files Monitored</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {monitoringStatus}
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">Monitoring Status</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                  {integrityLastScan ? 
                    new Date(integrityLastScan).toLocaleDateString() : 
                    'Never'
                  }
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Last Scan</p>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {integrityReport.message}
              </p>
            </div>

            {/* Show changed files if any */}
            {integrityReport.new_files && integrityReport.new_files.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">New Files Detected:</h4>
                <div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                  {integrityReport.new_files.slice(0, 5).map((file, index) => (
                    <p key={index}>• {file}</p>
                  ))}
                  {integrityReport.new_files.length > 5 && (
                    <p>... and {integrityReport.new_files.length - 5} more files</p>
                  )}
                </div>
              </div>
            )}

            {integrityReport.modified_files && integrityReport.modified_files.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Modified Files Detected:</h4>
                <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
                  {integrityReport.modified_files.slice(0, 5).map((file, index) => (
                    <p key={index}>• {file}</p>
                  ))}
                  {integrityReport.modified_files.length > 5 && (
                    <p>... and {integrityReport.modified_files.length - 5} more files</p>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Wordfence Vulnerability Scan */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🛡️ Wordfence Vulnerability Scan
            </h3>
            {(!vulnScan || Object.keys(vulnScan).length === 0 || !vulnScan.vulnerabilities) && (
              <Button
                onClick={() => {
                  const message = 'Please scan my WordPress site for security vulnerabilities using the Wordfence database. Check all active plugins and themes for known vulnerabilities and provide me a detailed report with recommended actions.'
                  sessionStorage.setItem('mat_prefill_message', message)
                  window.dispatchEvent(new CustomEvent('mat_switch_tab', { detail: { tab: 'chat' } }))
                }}
                size="sm"
                color="blue"
              >
                🤖 Get AI Security Scan
              </Button>
            )}
          </div>
          
          {vulnScan && Object.keys(vulnScan).length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                    {vulnScan.scanned_components || 0}
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200">Components Scanned</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
                    {vulnScan.vulnerabilities_found || vulnScan.vulnerabilities?.length || 0}
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200">Vulnerabilities Found</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                    {vulnScan.last_updated ? 
                      new Date(vulnScan.last_updated).toLocaleDateString() : 
                      'Never'
                    }
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">Last Scan</p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">
                    {vulnScan.data_source || 'Wordfence Intelligence'}
                  </p>
                  <p className="text-xs text-purple-800 dark:text-purple-200">Data Source</p>
                </div>
              </div>

              {vulnScan.vulnerabilities && vulnScan.vulnerabilities.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-gray-900 dark:text-white">Detected Vulnerabilities:</h4>
                    <Button
                      onClick={() => {
                        const message = `I have ${vulnScan.vulnerabilities.length} security vulnerabilities found on my WordPress site. Please analyze them and provide detailed recommendations for fixing each vulnerability, prioritizing by severity level.`
                        sessionStorage.setItem('mat_prefill_message', message)
                        window.dispatchEvent(new CustomEvent('mat_switch_tab', { detail: { tab: 'chat' } }))
                      }}
                      size="sm"
                      color="orange"
                    >
                      🤖 Get AI Remediation Help
                    </Button>
                  </div>
                  {vulnScan.vulnerabilities.map((vuln, index) => (
                    <div key={index} className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge color={
                            vuln.severity === 'Critical' ? 'failure' :
                            vuln.severity === 'High' ? 'warning' :
                            vuln.severity === 'Medium' ? 'yellow' :
                            vuln.severity === 'Low' ? 'info' : 'gray'
                          }>
                            {vuln.severity || 'Unknown'}
                          </Badge>
                          <h5 className="font-medium text-red-800 dark:text-red-200">
                            {vuln.component_name || vuln.component}
                          </h5>
                          {vuln.cvss_score && (
                            <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                              CVSS: {vuln.cvss_score}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          v{vuln.component_version}
                        </span>
                      </div>
                      <h6 className="font-medium text-red-900 dark:text-red-100 mb-1">
                        {vuln.title}
                      </h6>
                      {vuln.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {vuln.description}
                        </p>
                      )}
                      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                        <div>
                          {vuln.fixed_in && (
                            <span className="text-green-600 dark:text-green-400">
                              Fixed in version: {vuln.fixed_in}
                            </span>
                          )}
                        </div>
                        <div>
                          {vuln.published && (
                            <span>Published: {new Date(vuln.published).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      {vuln.references && vuln.references.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-700">
                          <p className="text-xs text-gray-500 dark:text-gray-400">References:</p>
                          <div className="flex gap-2 mt-1">
                            {vuln.references.slice(0, 3).map((ref, refIndex) => (
                              <a
                                key={refIndex}
                                href={ref.url || ref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {ref.type || 'Reference'} ↗
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-4xl mb-2">✅</div>
                  <h4 className="text-lg font-medium text-green-800 dark:text-green-200 mb-1">
                    No Vulnerabilities Found
                  </h4>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Your active plugins and theme appear to be secure based on the Wordfence database.
                  </p>
                  <Button
                    onClick={() => {
                      const message = 'Great news! No vulnerabilities were found in my WordPress site scan. Please provide me with additional security recommendations and best practices to keep my site secure.'
                      sessionStorage.setItem('mat_prefill_message', message)
                      window.dispatchEvent(new CustomEvent('mat_switch_tab', { detail: { tab: 'chat' } }))
                    }}
                    size="sm"
                    color="green"
                    className="mt-3"
                  >
                    🤖 Get Additional Security Tips
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-4xl mb-2">🔍</div>
              <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                No Vulnerability Scan Data
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Use the AI assistant to scan your WordPress site for security vulnerabilities using the free Wordfence Intelligence database.
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  onClick={() => {
                    const message = 'Please scan my WordPress site for security vulnerabilities using the Wordfence database. Check all active plugins and themes for known vulnerabilities and provide me a detailed report with recommended actions.'
                    sessionStorage.setItem('mat_prefill_message', message)
                    window.dispatchEvent(new CustomEvent('mat_switch_tab', { detail: { tab: 'chat' } }))
                  }}
                  color="blue"
                >
                  🤖 Start AI Security Scan
                </Button>
                <Button
                  onClick={() => {
                    const message = 'Please provide me with a comprehensive WordPress security checklist and best practices to protect my site from common vulnerabilities and attacks.'
                    sessionStorage.setItem('mat_prefill_message', message)
                    window.dispatchEvent(new CustomEvent('mat_switch_tab', { detail: { tab: 'chat' } }))
                  }}
                  color="gray"
                >
                  📋 Security Checklist
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* htaccess Protection & Inline Editor */}
        {securityData?.security_htaccess_protection && (
          <Card>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                📄 .htaccess Security Rules
              </h3>
              <div className="flex space-x-2">
                <Button
                  onClick={openHtaccessEditor}
                  disabled={htaccessLoading}
                  size="sm"
                  color="gray"
                >
                  {htaccessLoading && <Spinner size="sm" className="mr-2" />}
                  Edit .htaccess
                </Button>
                <Button
                  onClick={suggestHtaccessCode}
                  size="sm"
                  color="gray"
                >
                  AI Suggestion
                </Button>
              </div>
            </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {htaccessRulesStatus.map((rule, index) => (
                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex flex-col h-full">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const ruleStatus = rule.present !== undefined ? (rule.present ? 'ok' : 'missing') : (rule.status || 'unknown')
                      const label = rule.present !== undefined ? (rule.present ? 'Present' : 'Missing') : (rule.status || 'Unknown')
                      return (
                        <Badge color={getStatusColor(ruleStatus)}>{label}</Badge>
                      )
                    })()}
                    <h4 className="font-medium text-gray-900 dark:text-white">{rule.name}</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex-grow">{rule.description}</p>
                  {rule.recommendation && showTips && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                      💡 {rule.recommendation}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {showHtaccessEditor && (
              <div className="mt-4">
                {/* Warning Banner */}
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                        ⚠️ Critical Warning: .htaccess Editor
                      </h4>
                      <div className="space-y-2 text-sm text-red-700 dark:text-red-300">
                        <p className="font-medium">
                          <strong>Editing .htaccess can break your website access!</strong> Incorrect syntax can make your site completely inaccessible.
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>We automatically backed up your current .htaccess when opening this editor</li>
                          <li>Test changes on a staging site first if possible</li>
                          <li>Keep FTP/cPanel access ready to restore the file if needed</li>
                          <li>Only the 2 most recent backups are kept</li>
                        </ul>
                        <div className="mt-3 p-2 bg-green-100 dark:bg-green-900/30 rounded border border-green-300 dark:border-green-600">
                          <p className="text-green-800 dark:text-green-200 text-xs">
                            ✅ <strong>Safe Option:</strong> The "Quick Insert" security rules below are tested and generally safe to use. They follow WordPress best practices.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <textarea
                  ref={textareaRef}
                  value={htaccessContent}
                  onChange={handleHtaccessChange}
                  className="w-full h-64 font-mono text-sm bg-gray-100 dark:bg-gray-800 dark:text-gray-100 p-2 rounded resize-none"
                  spellCheck={false}
                  autoComplete="off"
                />
                
                {/* Quick Insert Buttons */}
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Quick Insert Security Rules:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Object.entries(htaccessRules).map(([key, rule]) => (
                      <button
                        key={key}
                        onClick={() => insertHtaccessRule(rule.code)}
                        className={`flex flex-col items-start p-3 text-left border rounded transition-colors ${
                          key === 'eightGFirewall' 
                            ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-red-200 dark:border-red-700' 
                            : 'bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600'
                        }`}
                        title={rule.description}
                      >
                        <span className={`text-sm font-medium ${
                          key === 'eightGFirewall' 
                            ? 'text-red-800 dark:text-red-200' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {key === 'eightGFirewall' && '🛡️ '}{rule.name}
                        </span>
                        <span className={`text-xs mt-1 ${
                          key === 'eightGFirewall' 
                            ? 'text-red-600 dark:text-red-300' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {rule.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex space-x-2 justify-end">
                  <Button onClick={saveHtaccess} disabled={htaccessSaving}>
                    {htaccessSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button onClick={closeHtaccessEditor} size="sm" color="gray">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Action Buttons */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Need Fresh Security Analysis?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Get the latest security insights and recommendations from your AI assistant.
              </p>
            </div>
            <Button 
              onClick={requestSecurityScan}
              disabled={isGeneratingData}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
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
                  Update Security Analysis
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Critical Issues Modal */}
        <ConfirmationModal
          isOpen={showCriticalModal}
          onClose={() => setShowCriticalModal(false)}
          onConfirm={() => setShowCriticalModal(false)}
          title="Critical Issues Detected"
          message="Below is a breakdown of items that require immediate attention."
          showActions={false}
          icon="warning"
        >
          {(() => {
            const sections = []

            // 1. File permission issues
            if (filePermsRaw?.issues && filePermsRaw.issues.length > 0) {
              sections.push({
                label: 'File Permission Issues',
                items: filePermsRaw.issues.map(issue => (
                  <li key={issue.path} className="flex flex-col">
                    <div>
                      <span className="font-medium">{issue.path}</span>
                      <span className="block">Current: {issue.current_permissions} → Recommended: {issue.recommended_permissions}</span>
                      {issue.risk && <span className="text-red-600 dark:text-red-400">Risk: {issue.risk}</span>}
                    </div>
                    <button onClick={() => navigateToSection(filePermSectionRef)} className="mt-1 self-start text-xs text-blue-600 hover:underline">View in report ↗</button>
                  </li>
                ))
              })
            } else if (criticalIssues > 0) {
              sections.push({
                label: 'File Permission Issues',
                items: [
                  <li key="perm-summary" className="flex flex-col">
                    <span>{criticalIssues} critical file permission issues detected.</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Detailed paths were not provided in the report.</span>
                    <button onClick={() => navigateToSection(filePermSectionRef)} className="mt-1 self-start text-xs text-blue-600 hover:underline">View section ↗</button>
                  </li>
                ]
              })
            }

            // 2. Modified core files
            if ((coreChecksum.modified || coreChecksum.modified_files || []).length > 0) {
              const list = (coreChecksum.modified || coreChecksum.modified_files).slice(0, 50) // cap list
              sections.push({
                label: 'Modified WordPress Core Files',
                items: list.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <span>{file}</span>
                    <button onClick={() => navigateToSection(coreSectionRef)} className="text-xs text-blue-600 hover:underline">View section ↗</button>
                  </li>
                ))
              })
            }

            // 3. Plugin modified files / status failure
            const pluginCritical = pluginsArray.filter(p => p.status?.toLowerCase() === 'critical' || (p.modified_files && p.modified_files.length > 0))
            if (pluginCritical.length > 0) {
              sections.push({
                label: 'Plugin Integrity Issues',
                items: pluginCritical.map((p, idx) => (
                  <li key={idx} className="flex flex-col">
                    <span className="font-medium">{p.name}</span>
                    {p.modified_files && p.modified_files.length > 0 && (
                      <span className="text-xs">Modified files: {p.modified_files.slice(0,3).join(', ')}{p.modified_files.length>3?'…':''}</span>
                    )}
                    <button onClick={() => navigateToSection(pluginSectionRef)} className="mt-1 self-start text-xs text-blue-600 hover:underline">View section ↗</button>
                  </li>
                ))
              })
            }

            // 4. Theme modified files
            const themeCritical = themesArray.filter(t => t.status?.toLowerCase() === 'critical' || (t.modified_files && t.modified_files.length > 0))
            if (themeCritical.length > 0) {
              sections.push({
                label: 'Theme Integrity Issues',
                items: themeCritical.map((t, idx) => (
                  <li key={idx} className="flex flex-col">
                    <span className="font-medium">{t.name}</span>
                    {t.modified_files && t.modified_files.length > 0 && (
                      <span className="text-xs">Modified files: {t.modified_files.slice(0,3).join(', ')}{t.modified_files.length>3?'…':''}</span>
                    )}
                    <button onClick={() => navigateToSection(themeSectionRef)} className="mt-1 self-start text-xs text-blue-600 hover:underline">View section ↗</button>
                  </li>
                ))
              })
            }

            if (sections.length === 0) {
              return <p className="text-gray-600 dark:text-gray-400">No critical issues details available.</p>
            }

            return (
              <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 max-h-[60vh] overflow-y-auto pr-2">
                {sections.map((section, idx) => (
                  <div key={idx}>
                    <h4 className="font-semibold mb-2 text-red-700 dark:text-red-300">{section.label}</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {section.items}
                    </ul>
                  </div>
                ))}
              </div>
            )
          })()}
        </ConfirmationModal>
      </div>
    )
  }, [
    securityData,
    htaccessContent,
    showHtaccessEditor,
    htaccessLoading,
    htaccessSaving,
    showCriticalModal,
    settings?.show_tips,
    adminData,
    handleHtaccessChange,
    closeHtaccessEditor,
    insertHtaccessRule,
    htaccessRules
  ])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="xl" />
        <span className="ml-3 text-gray-600 dark:text-gray-300">Loading security data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {hasData ? DataView : <EmptyState />}
    </div>
  )
}

export default Security 