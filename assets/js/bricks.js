window.MagicAssistantBricks = {
    vueState: null,
    vueGlobalProp: null,
    bricksData: null,

    init: function() {
        if (typeof bricksData === 'undefined' || !document.querySelector('.brx-body') || !document.querySelector('.brx-body').__vue_app__) {
            console.log('MagicAssistant: Bricks Builder not ready.');
            return;
        }
        
        console.log('MagicAssistant: Bricks Builder detected. Initializing integration.');

        this.vue = document.querySelector('.brx-body').__vue_app__;
        this.vueGlobalProp = this.vue.config.globalProperties;
        this.vueState = this.vueGlobalProp.$_state;
        this.bricksData = bricksData;

        // The main function to be called from the React component
        window.magicAssistantInsertHTML = (html, css, js) => {
            this.htmlImporter({ html, css, js });
        };
    },

    htmlImporter: function (cmValues) {
        const rootId = this.vueGlobalProp.$_generateId();
        const contentType = this.helpers.getTemplateType();
    
        const activeElement = this.vueState.activeElement;
        const isParent = activeElement ? this.helpers.isElementOnRoot(activeElement.parent) : false;
    
        let parentId;
    
        if (!activeElement || (isParent && !this.vueGlobalProp.$_isNestable({name: activeElement.name}))) {
            parentId = 0;
        } else if (this.vueGlobalProp.$_isNestable({name: activeElement.name})) {
            parentId = this.vueState.activeId;
            this.helpers.getElementObject(parentId).children.push(rootId);
        } else {
            parentId = activeElement.parent;
            this.helpers.getElementObject(parentId).children.push(rootId);
        }

        const states = {
            includesIds: true,
            excludeIds: 'brxe-,brx-',
            includesClasses: true,
            excludeClasses: 'brxe-,brx-',
            createGlobalClasses: true, 
            includesTexts: true,
            includesAttributes: true,
            excludeAttributes: 'href,src',
        };

        const arr = this.helpers.parseHtmlStringToObjectArray(rootId, parentId, cmValues, states);

        if (this.helpers.isComponentActive()) {
            this.vueState.activeComponent.elements = this.vueState.activeComponent.elements.concat(arr.reverse());
        } else {
            this.vueState[contentType] = this.vueState[contentType].concat(arr.reverse());
        }
    
        setTimeout(() => {
            this.helpers.openElement(rootId);
            this.vueGlobalProp.$_showMessage('Structure imported Successfully!');
        }, 10);
    },

    helpers: {
        
        parseHtmlStringToObjectArray: function(rootId, parentId, cmValues, codepenStates){
            const parser = new DOMParser();
            const doc = parser.parseFromString(cmValues.html, 'text/html');
            
            doc.body.querySelectorAll('*').forEach(el => {
                const childNodes = Array.from(el.childNodes);
                const hasText = childNodes.some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
                const hasElements = childNodes.some(n => n.nodeType === Node.ELEMENT_NODE);
                
                if (hasText && hasElements) {
                    window.MagicAssistantBricks.helpers.wrapTextNodesInSpan(el);
                }
            })

            const elementsArray = [];
            const rootChildren = [];
        
            function setDefaultTag(elementObj, tag, hasCustomTag){
                if(hasCustomTag){
                    elementObj.settings.tag = 'custom';
                    elementObj.settings.customTag = tag;
                } else {
                    elementObj.settings.tag = tag;
                }
            }
        
            function traverseElement(element, parentId = rootId) {
                const id = window.MagicAssistantBricks.vueGlobalProp.$_generateId();
                const tagName = element.tagName.toLowerCase();
                const bricksName = window.MagicAssistantBricks.helpers.elementTagbyHTMLTag(element, tagName);
                const elementConfig = window.MagicAssistantBricks.vueGlobalProp.$_getElementConfig(bricksName);
        
                let elementObj = {
                    id: id,
                    name: bricksName,
                    parent: parentId,
                    children: [],
                    settings: {},
                };

                const isNestable = window.MagicAssistantBricks.vueGlobalProp.$_isNestable(elementObj);
        
                if(elementConfig.tag !== tagName){
                    if(tagName === "img" || tagName.startsWith('b-')){
                        // silence
                    } else{
                        let isOption = false;
                        if(elementConfig.controls.hasOwnProperty('tag') && !elementConfig.controls.tag.hasOwnProperty('customTag')){
                            // can't change the tag
                        }
                        if(elementConfig.controls.hasOwnProperty('tag') && elementConfig.controls.tag.hasOwnProperty('options')){
                            for(const key in elementConfig.controls.tag.options){
                                if(key == tagName) isOption = true;
                            }
                        }
        
                        if(isOption){
                            elementObj.settings.tag = tagName;
                        } else {
                            setDefaultTag(elementObj, tagName, elementConfig.controls.hasOwnProperty('customTag'));
                        }
                    }
                }
            
                if(codepenStates.includesIds) elementObj = window.MagicAssistantBricks.helpers.setIdFromParsedHTML(element, elementObj, codepenStates);
                if(codepenStates.includesClasses) elementObj = window.MagicAssistantBricks.helpers.setClassesFromParsedHTML(element, elementObj, codepenStates);
                if(codepenStates.includesTexts) elementObj = window.MagicAssistantBricks.helpers.setTextFromParsedHTML(element, elementObj, elementConfig);
                if(codepenStates.includesAttributes) elementObj = window.MagicAssistantBricks.helpers.setAttributesFromParsedHTML(element, elementObj, codepenStates);
                
                const children = [...element.children];
                if (children.length > 0 && isNestable) {
                    children.forEach((child) => {
                        const childObj = traverseElement(child, id);
                        elementObj.children.push(childObj.id);
                    });
                }
               
                elementsArray.push(elementObj);
                
                return elementObj;
            }
        
            [...doc.body.children].forEach((element) => {
                const topLevelElement = traverseElement(element);
                rootChildren.push(topLevelElement.id);
            });

            if(cmValues.css || cmValues.js){
                const codeId = window.MagicAssistantBricks.vueGlobalProp.$_generateId();
                const codeObj = {
                    id: codeId,
                    name: 'code',
                    label: 'CSS/JS Code',
                    parent: rootId,
                    children: [],
                    settings: {},
                }
                if(cmValues.css && typeof css_beautify !== 'undefined'){
                    codeObj.settings.cssCode = css_beautify(cmValues.css, { indent_size: 2 });
                } else if (cmValues.css) {
                    codeObj.settings.cssCode = cmValues.css;
                }
                if(cmValues.js){
                    codeObj.settings.javascriptCode = cmValues.js;
                }
                elementsArray.splice(0, 0, codeObj);
                rootChildren.splice(0, 0, codeId);
            }
            const parentObj = {
                id: rootId,
                name: 'div',
                label: 'Generated By MagicAssistant',
                parent: parentId,
                children: rootChildren,
                settings: {},
            }

            elementsArray.push(parentObj);
            return elementsArray;
        },

        wrapTextNodesInSpan: function (node){
            node.childNodes.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                  const span = document.createElement('span');
                  span.textContent = child.textContent.trim();
                  node.replaceChild(span, child);
                }
            });
        },

        elementTagbyHTMLTag: function(parsedElement, tag) {
            if(tag.startsWith("b-")){
                return tag.replace("b-","");
            }
            const completeMapping = {
                'section': ['section'],
                'div': ['div', 'a', 'article', 'nav', 'ol', 'ul', 'li', 'aside'],
                'text-basic': ['p', 'span', 'figcaption', 'address'],
                'heading': ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
                'image': ['img', 'picture'],
                'video': ['video'],
                'button': ['button'],
                'code': ['style', 'script']
            };
        
            const textOnlyKeys = ['text-basic', 'heading', 'button', 'code'];
        
            if (parsedElement.textContent && typeof parsedElement.textContent === "string" && parsedElement.textContent.length > 0 && parsedElement.children.length === 0) {
                for (const key of textOnlyKeys) {
                    if (completeMapping[key].includes(tag)) {
                        return key;
                    }
                }
                return 'text-basic';
            }
        
            for (const key in completeMapping) {
                if (completeMapping[key].includes(tag)) {
                    return key;
                }
            }
        
            return 'div';
        },

        setIdFromParsedHTML: function (parsedElement, obj, codepenStates){
            const id = parsedElement.id;

            if (codepenStates.excludeIds !== '' && codepenStates.excludeIds.replaceAll(' ', '').split(',').some(item => id.trim().toLowerCase().includes(item.trim().toLowerCase()))) {
                return obj;
            }          
            if(!id && obj.settings.hasOwnProperty('_cssId')){
                delete obj.settings._cssId;
            } else if (id && id !== `brxe-${obj.id}`){
                obj.settings._cssId = id;
            }
            return obj;
        },

        setClassesFromParsedHTML: function(parsedElement, obj, codepenStates){
            const classes = parsedElement.className;
            if(classes && typeof classes === "string"){
                const classesArr = classes.split(' ');
                const globalClasses = [];
                const cssClasses = [];
                classesArr.forEach(tempCls => {
                    if (codepenStates.excludeClasses !== '' && codepenStates.excludeClasses.replaceAll(' ', '').split(',').some(item => tempCls.trim().toLowerCase().includes(item.trim().toLowerCase()))) {
                        return;
                    }
                    
                    const existingGlobalClass = window.MagicAssistantBricks.vueState.globalClasses.find(el => el && el.name === tempCls);
                    if(existingGlobalClass) {
                        globalClasses.push(existingGlobalClass.id);
                    } else {
                        if(codepenStates.createGlobalClasses){
                            const newId = window.MagicAssistantBricks.vueGlobalProp.$_generateId();
                            window.MagicAssistantBricks.vueState.globalClasses.push({
                                id: newId,
                                name: tempCls,
                                settings: {},
                            })
                            globalClasses.push(newId);
                        } else {
                            cssClasses.push(tempCls)
                        }
                    }
                })
                if(globalClasses.length > 0){
                    obj.settings._cssGlobalClasses = globalClasses;
                } else {
                    delete obj.settings._cssGlobalClasses;
                }
                if(cssClasses.length > 0){
                    obj.settings._cssClasses = cssClasses.join(' ');
                } else {
                    delete obj.settings._cssClasses;
                }
            } else {
                delete obj.settings._cssGlobalClasses;
                delete obj.settings._cssClasses;
            }

            return obj;
        },

        setTextFromParsedHTML: function(parsedElement, obj, objConfig){
            const innerText = parsedElement.innerHTML.trim();
            const tagName = parsedElement.tagName.toLowerCase();

            if(innerText && tagName === "style"){
                obj.settings.cssCode = innerText;
                obj.settings.noRoot = true;
                return obj;
            }
            if(innerText && tagName === "script"){
                obj.settings.javascriptCode = innerText;
                obj.settings.noRoot = true;
                return obj;
            }

            if(!innerText && objConfig.controls.hasOwnProperty('text')){
                delete obj.settings.text;
            } else if(objConfig.controls.hasOwnProperty('text') && innerText && typeof innerText === "string" && innerText.length > 0){
                obj.settings.text = innerText;
            }

            return obj
        },

        setAttributesFromParsedHTML: function(parsedElement, obj, codepenStates) {
            const attributes = [];
        
            for (const attr of parsedElement.attributes) {
                const attrName = attr.name.toLowerCase();
                const attrValue = attr.value.trim();
        
                if (attrName === "id" || attrName === "class" || 
                    codepenStates.excludeAttributes.replaceAll(' ', '').split(',').some(item => item.trim().toLowerCase() === attrName)) {
                    continue;
                }

                if (attrName === "src") {
                    obj.settings.image = {
                        url: window.MagicAssistantBricks.helpers.getFilenameURLFromUrl(attrValue),
                        external: true,
                        filename: window.MagicAssistantBricks.helpers.getFilenameFromUrl(attrValue)
                    };
                }
                else if(attrName === "data-bricks-label"){
                    obj.label = window.MagicAssistantBricks.helpers.capitalizeString(attrValue);
                }
                else if (attrName === "href") {
                    obj.settings.link = "url";
                    obj.settings.url = obj.settings.url || {};
                    obj.settings.url.url = attrValue;
                    obj.settings.url.type = "external";
                }
                else if (attrName === "rel") {
                    obj.settings.url = obj.settings.url || {};
                    obj.settings.url.rel = attrValue;
                }
                else if (attrName === "title") {
                    obj.settings.url = obj.settings.url || {};
                    obj.settings.url.title = attrValue;
                }
                else if (attrName === "aria-label") {
                    obj.settings.url = obj.settings.url || {};
                    obj.settings.url.ariaLabel = attrValue;
                }
                else if (attrName === "target" && attrValue === "_blank") {
                    obj.settings.url = obj.settings.url || {};
                    obj.settings.url.newTab = true;
                }
                else if (attrName === "alt") {
                    obj.settings.altText = attrValue;
                }
                else if (attrName === "loading") {
                    obj.settings.loading = attrValue;
                }
                else {
                    const attrObj = {
                        id: window.MagicAssistantBricks.vueGlobalProp.$_generateId(),
                        name: attrName,
                        value: attrValue
                    };
                    attributes.push(attrObj);
                }
            }
        
            if (attributes.length > 0) {
                obj.settings._attributes = attributes;
            } else if (obj.settings.hasOwnProperty('_attributes')) {
                delete obj.settings._attributes;
            }
        
            return obj;
        },

        getTemplateType: function(){
            const templateType = window.MagicAssistantBricks.vueState.templateType;
            if(templateType === "section" || templateType === "archive" || templateType === "error" || templateType === "popup" || templateType === "search" || !window.MagicAssistantBricks.vueState.hasOwnProperty(templateType)){
                return "content";
            } else {
                return templateType;
            }
        },

        isElementOnRoot: function(parent){
            return parent === 0 || (window.MagicAssistantBricks.helpers.isComponentActive() && window.MagicAssistantBricks.helpers.isComponentRoot(parent));
        },
        
        getElementObject: function(id, forceStructure = false){
            const getElementObject = window.MagicAssistantBricks.vueGlobalProp.$_getElementObject;
            const getDynamicElementById = window.MagicAssistantBricks.vueGlobalProp.$_getDynamicElementById;
        
            if (typeof getElementObject === 'function') {
                return getElementObject(id);
            } else if (typeof getDynamicElementById === 'function') {
                const obj = getDynamicElementById(id);
                if(obj && obj.hasOwnProperty('cid') && !forceStructure){
                    return window.MagicAssistantBricks.vueGlobalProp.$_getComponentElementById(obj.cid);
                } else {
                    return obj;
                }
            } else {
                console.error("No suitable function available to get element object.");
                return null;
            }
        },

        isComponentActive: function(){
            if(!window.MagicAssistantBricks.vueState.hasOwnProperty('components')) return false;
            const activeComponent = window.MagicAssistantBricks.vueState.activeComponent;
            if (typeof activeComponent === "undefined"
                || activeComponent === false
                || activeComponent === "" 
                || !activeComponent.hasOwnProperty('id')) return false;
            return true;
        },

        openElement: function(id){
            const obj = this.getElementObject(id)
            window.MagicAssistantBricks.vueState.activePanel = "element";
            window.MagicAssistantBricks.vueState.activeId = id;
            window.MagicAssistantBricks.vueState.activeElement = obj;
    
            if(window.MagicAssistantBricks.vueState.hasOwnProperty('components') && window.MagicAssistantBricks.vueState.components.some(el => el.id === id)){
                window.MagicAssistantBricks.vueState.activeComponent = window.MagicAssistantBricks.vueState.components.find(el => el.id === id);
            }
    
            if(this.isElementInComponent(id)){
                window.MagicAssistantBricks.vueState.activeComponent = this.getComponentByElementId(id)
            }
        },

        isValidFileUrl(url){
            try {
                const parsedUrl = new URL(url);
                return parsedUrl;
            } catch (error) {
                return false;
            }
        },

        getFilenameURLFromUrl: function(url){
            const parsedUrl = this.isValidFileUrl(url);
            if(!parsedUrl){
                return window.MagicAssistantBricks.bricksData.placeholderImg;
            } else {
                return url;
            }
        },

        getFilenameFromUrl: function(url) {
            const parsedUrl = this.isValidFileUrl(url);
            if(!parsedUrl){
                return 'placeholder-image-png';
            } else {
                const path = parsedUrl.pathname;
                const filename = path.split('/').pop();
                return filename;
            }
        },

        capitalizeString: function(string){
            return string.toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        },

        isComponentRoot: function(id){
            if(!window.MagicAssistantBricks.vueState.hasOwnProperty('components')) return false;
            const obj = window.MagicAssistantBricks.vueGlobalProp.$_getComponentById(id);
            return obj && typeof obj === "object" && obj.hasOwnProperty('id');
        },

        isElementInComponent: function(id) {
            if (!window.MagicAssistantBricks.vueState.hasOwnProperty('components')) return false;
            const allElements = window.MagicAssistantBricks.vueState.components.flatMap(component => component.elements || []);
            return allElements.some(element => element.id === id);
        },

        getComponentByElementId: function(id) {
            if (!window.MagicAssistantBricks.vueState.hasOwnProperty('components')) return false;
            return window.MagicAssistantBricks.vueState.components.find(component =>
                (component.elements || []).some(element => element.id === id)
            );
        },
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // We need to wait for Bricks to be fully initialized
    setTimeout(() => {
        if(typeof window.MagicAssistantBricks !== 'undefined') {
            window.MagicAssistantBricks.init();
        }
    }, 2000); // A 2-second delay should be safe
});