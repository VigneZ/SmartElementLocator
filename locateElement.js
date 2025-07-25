/**
 * Smart Element Finder - Intelligently identifies elements by various text attributes and proximity
 * @param {string} searchText - The text to search for (partial or full match)
 * @param {Object} options - Configuration options
 * @param {string} options.type - Preferred element type ('button', 'link', 'input', etc.) for disambiguation
 * @param {boolean} options.exactMatch - Whether to use exact text matching (default: false)
 * @param {boolean} options.caseSensitive - Whether matching should be case sensitive (default: false)
 * @param {Element} options.container - Container element to search within (default: document)
 * @param {number} options.maxResults - Maximum number of results to return (default: 10)
 * @param {boolean} options.includeHidden - Whether to include hidden elements (default: false)
 * @param {string|Element} options.near - Text to locate a reference element, or the reference element itself, for proximity search.
 * @param {number} options.proximityThreshold - Maximum distance in pixels for elements to be considered "near" (default: 200)
 * @param {string[]} options.directions - Preferred directions for proximity (e.g., ['right', 'below'], default: ['right', 'below', 'left', 'above'])
 * @returns {Array<Element>} Array of matching elements, sorted by relevance and proximity
 */
function locateElement(searchText, options = {}) {
    let {
        type = null, // 'type' can now be overridden by search text
        exactMatch = false,
        caseSensitive = false,
        container = document,
        maxResults = 10,
        includeHidden = false,
        near = null, // NEW: Reference element/text for proximity
        proximityThreshold = 200, // NEW: Max distance for proximity
        directions = ['right', 'below', 'left', 'above'] // NEW: Preferred directions
    } = options;

    if (!searchText || typeof searchText !== 'string') {
        throw new Error('Search text must be a non-empty string');
    }

    const normalizedSearchText = caseSensitive ? searchText : searchText.toLowerCase();
    const matches = [];

    // Determine preferred type from search text if not explicitly provided in options
    if (type === null) {
        const inferredType = getPreferredTypeFromSearchText(normalizedSearchText);
        if (inferredType) {
            type = inferredType;
            searchText= searchText.replaceAll(type,"")
        }
    }

    // Helper function to normalize text for comparison
    function normalizeText(text) {
        if (!text || typeof text !== 'string') return '';
        return caseSensitive ? text.trim() : text.trim().toLowerCase();
    }

    // Helper function to check if text matches search criteria
    function textMatches(text, searchText, exact = false) {
        if (!text) return false;
        const normalizedText = normalizeText(text);
        const normalizedSearch = normalizeText(searchText);

        if (exact) {
            return normalizedText === normalizedSearch;
        } else {
            // Check for exact phrase inclusion first
            if (normalizedText.includes(normalizedSearch)) {
                return true;
            }

            // If not an exact phrase match, check if all words are present (order independent)
            const searchWords = normalizedSearch.split(/\s+/).filter(word => word.length > 0);
            if (searchWords.length === 0) return false;

            return searchWords.every(word => normalizedText.includes(word));
        }
    }

    // Calculate match quality score (0-100, higher is better)
    function getMatchQuality(text, searchText) {
        if (!text) return 0;

        const normalizedText = normalizeText(text);
        const normalizedSearch = normalizeText(searchText);

        // Exact match gets maximum score
        if (normalizedText === normalizedSearch) {
            return 100;
        }

        const textLength = normalizedText.length;
        const searchLength = normalizedSearch.length;

        // Check for ordered phrase inclusion
        if (normalizedText.includes(normalizedSearch)) {
            // Word boundary matches get higher scores
            const wordBoundaryMatch = new RegExp(`\\b${normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\')}\\b`).test(normalizedText);
            if (wordBoundaryMatch) {
                const ratio = searchLength / textLength;
                return Math.min(95, 60 + (ratio * 35)); // 60-95 range for word boundary matches
            }

            // Starts with search term
            if (normalizedText.startsWith(normalizedSearch)) {
                const ratio = searchLength / textLength;
                return Math.min(85, 40 + (ratio * 45)); // 40-85 range for starts-with matches
            }

            // Contains search term (partial, ordered match)
            const ratio = searchLength / textLength;
            return Math.min(70, 10 + (ratio * 60)); // 10-70 range for contains matches
        }

        // Check for all words present, order independent
        const searchWords = normalizedSearch.split(/\s+/).filter(word => word.length > 0);
        if (searchWords.length > 0 && searchWords.every(word => normalizedText.includes(word))) {
            const matchedWordCount = searchWords.filter(word => normalizedText.includes(word)).length;
            const totalSearchWords = searchWords.length;
            const wordCoverageRatio = matchedWordCount / totalSearchWords;

            // Score based on word coverage and how much of the text is covered by search words
            const combinedSearchLength = searchWords.reduce((sum, word) => sum + word.length, 0);
            const contentCoverageRatio = combinedSearchLength / textLength;

            // A lower score for out-of-order matches, ensuring they don't outrank ordered matches
            return Math.min(50, 5 + (wordCoverageRatio * 20) + (contentCoverageRatio * 25)); // 5-50 range for out-of-order word matches
        }

        return 0; // No match
    }

    // Helper function to extract preferred element type from search text
    function getPreferredTypeFromSearchText(text) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('button')) {
            return 'button';
        }
        if (lowerText.includes('link')) {
            return 'link';
        }
        if (lowerText.includes('input') || lowerText.includes('field') || lowerText.includes('text box') || lowerText.includes('textbox')) {
            return 'input'; // General 'input' type to cover various input fields
        }
        return null;
    }

    // Helper function to get all text content sources for an element
    function getElementTextSources(element) {
        const sources = {};

        // Direct text content
        sources.textContent = element.textContent || '';
        sources.innerText = element.innerText || '';

        // Form-related attributes
        sources.value = element.value || '';
        sources.placeholder = element.placeholder || '';

        // Accessibility attributes
        sources.ariaLabel = element.getAttribute('aria-label') || '';
        sources.ariaLabelledBy = getAriaLabelledByText(element) || '';
        sources.ariaDescribedBy = getAriaDescribedByText(element) || '';
        sources.title = element.title || '';
        sources.alt = element.alt || '';

        // Label association for form elements
        sources.labelText = getLabelText(element) || '';

        // Data attributes that might contain text
        sources.dataLabel = element.getAttribute('data-label') || '';
        sources.dataTitle = element.getAttribute('data-title') || '';
        sources.dataTestId = element.getAttribute('data-testid') || '';
        sources.dataTest = element.getAttribute('data-test') || '';

        // Name attribute
        sources.name = element.name || '';

        // ID attribute (sometimes contains readable text)
        sources.id = element.id || '';

        // Class names (sometimes contain readable text)
        sources.className = element.className || '';

        return sources;
    }

    // Get text from aria-labelledby reference
    function getAriaLabelledByText(element) {
        const labelledBy = element.getAttribute('aria-labelledby');
        if (!labelledBy) return '';

        const labelIds = labelledBy.split(/\s+/);
        const labelTexts = labelIds.map(id => {
            const labelElement = container.querySelector(`#${id}`);
            return labelElement ? (labelElement.textContent || '') : '';
        }).filter(text => text.trim());

        return labelTexts.join(' ');
    }

    // Get text from aria-describedby reference
    function getAriaDescribedByText(element) {
        const describedBy = element.getAttribute('aria-describedby');
        if (!describedBy) return '';

        const descIds = describedBy.split(/\s+/);
        const descTexts = descIds.map(id => {
            const descElement = container.querySelector(`#${id}`); // Corrected: Use #id selector
            return descElement ? (descElement.textContent || '') : '';
        }).filter(text => text.trim());

        return descTexts.join(' ');
    }

    // Get associated label text for form elements
    function getLabelText(element) {
        // Check for explicit label association
        if (element.id) {
            const label = container.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent || '';
        }

        // Check for implicit label association (element inside label)
        const parentLabel = element.closest('label');
        if (parentLabel) return parentLabel.textContent || '';

        return '';
    }

    // Detect element type automatically, enhanced to consider role, title, aria-label, and placeholder
    function detectElementType(element) {
        const tagName = element.tagName.toLowerCase();
        const elementType = element.type ? element.type.toLowerCase() : '';
        const role = element.getAttribute('role');
        const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
        const title = (element.title || '').toLowerCase();
        const placeholder = (element.placeholder || '').toLowerCase();

        // Priority 1: Direct HTML Tags & Input Types
        // Button detection
        if (tagName === 'button' ||
            (tagName === 'input' && ['button', 'submit', 'reset'].includes(elementType))) {
            return 'button';
        }
        // Link detection
        if (tagName === 'a') {
            return 'link';
        }
        // Input detection
        if (tagName === 'input') {
            return elementType || 'input'; // Returns specific type like 'text', 'email', or 'input'
        }
        // Other form elements
        if (['textarea', 'select'].includes(tagName)) {
            return tagName;
        }

        // Priority 2: ARIA Role attribute
        if (role) {
            if (role === 'button') {
                return 'button';
            }
            if (role === 'link') {
                return 'link';
            }
            if (role === 'textbox' || role === 'searchbox' || role === 'combobox') {
                return 'input'; // General input type for various textbox roles
            }
            if (role === 'checkbox') {
                return 'checkbox';
            }
            if (role === 'radio') {
                return 'radio';
            }
            if (role === 'menuitem') {
                return 'menuitem';
            }
        }

        // Priority 3: Semantic keywords in aria-label, title, or placeholder for generic elements
        // This is applied if the element doesn't have a strong semantic tag or role
        if (!['button', 'a', 'input', 'textarea', 'select'].includes(tagName) && !role) {
            const combinedTextAttributes = `${ariaLabel} ${title} ${placeholder}`;

            if (combinedTextAttributes.includes('button') || combinedTextAttributes.includes('submit') || combinedTextAttributes.includes('send') || combinedTextAttributes.includes('save')) {
                return 'button';
            }
            if (combinedTextAttributes.includes('link') || combinedTextAttributes.includes('more') || combinedTextAttributes.includes('read')) {
                return 'link';
            }
            if (combinedTextAttributes.includes('input') || combinedTextAttributes.includes('field') || combinedTextAttributes.includes('text') || combinedTextAttributes.includes('search') || combinedTextAttributes.includes('email') || combinedTextAttributes.includes('password') || combinedTextAttributes.includes('enter') || combinedTextAttributes.includes('box')) {
                return 'input';
            }
        }

        // Default detection for interactive elements without specific type or strong semantic hints
        if (element.hasAttribute('onclick') || element.tabIndex >= 0) {
            return 'interactive';
        }

        return tagName; // Fallback to tag name if no specific type is detected
    }

    // Check if element matches the preferred type
    function matchesElementType(element, type) {
        const detectedType = detectElementType(element);
        const normalizedType = type.toLowerCase();

        // Direct match
        if (detectedType === normalizedType) {
            return true;
        }

        // Flexible matching
        switch (normalizedType) {
            case 'button':
                return ['button', 'submit', 'reset'].includes(detectedType);
            case 'input':
                return ['input', 'text', 'email', 'password', 'search', 'tel', 'url', 'number', 'textarea', 'select', 'checkbox', 'radio'].includes(detectedType);
            case 'text': // for generic text input fields
                return ['input', 'textarea', 'text', 'email', 'password', 'search'].includes(detectedType);
            case 'field': // for any form field
                return ['input', 'textarea', 'select', 'text', 'email', 'password', 'search', 'tel', 'url', 'number', 'checkbox', 'radio'].includes(detectedType);
            default:
                return detectedType.includes(normalizedType) || normalizedType.includes(detectedType);
        }
    }

    // Check semantic appropriateness of search text vs element type
    function isSemanticMatch(searchText, elementType) {
        const text = searchText.toLowerCase();
        const buttonWords = ['submit', 'save', 'send', 'login', 'register', 'click', 'press', 'button'];
        const linkWords = ['link', 'more', 'read', 'view', 'go', 'navigate'];
        const inputWords = ['name', 'email', 'password', 'search', 'input', 'field', 'enter', 'text', 'box'];

        if (elementType === 'button' && buttonWords.some(word => text.includes(word))) {
            return true;
        }

        if (elementType === 'link' && linkWords.some(word => text.includes(word))) {
            return true;
        }

        if (['input', 'textarea', 'select'].includes(elementType) && inputWords.some(word => text.includes(word))) {
            return true;
        }

        return false;
    }

    // Check if element is interactive
    function isInteractiveElement(element) {
        const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
        const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'tab', 'menuitem'];

        return interactiveTags.includes(element.tagName.toLowerCase()) ||
               interactiveRoles.includes(element.getAttribute('role')) ||
               element.hasAttribute('onclick') ||
               element.hasAttribute('onkeydown') ||
               element.tabIndex >= 0;
    }

    // Check if element is hidden
    function isHidden(element) {
        // Quick check for definitely hidden elements
        if (element.offsetWidth === 0 && element.offsetHeight === 0) {
            return true;
        }

        // Check if element or any parent is hidden
        // This handles elements that are not in the DOM layout flow (e.g., display: none on a parent)
        if (element.offsetParent === null && element !== document.body && element !== document.documentElement) {
            return true;
        }

        const style = window.getComputedStyle(element);
        return style.display === 'none' ||
               style.visibility === 'hidden' ||
               parseFloat(style.opacity) === 0 ||
               element.hidden ||
               element.getAttribute('aria-hidden') === 'true';
    }

    // --- NEW PROXIMITY LOGIC START ---
    let referenceElement = null;
    let referenceElementRect = null;

    if (near) {
        if (near instanceof Element) {
            referenceElement = near;
        } else if (typeof near === 'string') {
            // Recursively call locateElement to find the reference element
            // Use a more generic search for the reference element, with a broader maxResults if needed
            // but keep it to 1 if we just want the 'best' reference.
            // Ensure no circular dependency by removing 'near' from referenceOptions.
            const referenceOptions = {
                container: container,
                exactMatch: exactMatch, // Maintain consistency with exactMatch for reference
                caseSensitive: caseSensitive,
                maxResults: 1, // We only need one primary reference element
                includeHidden: includeHidden // If reference can be hidden
            };
            const foundReferences = locateElement(near, referenceOptions);
            if (foundReferences.length > 0) {
                referenceElement = foundReferences[0];
            }
        }

        if (referenceElement) {
            try {
                referenceElementRect = referenceElement.getBoundingClientRect();
                // Check if rect is valid (e.g., element not disconnected)
                if (referenceElementRect.width === 0 && referenceElementRect.height === 0) {
                     console.warn(`locateElement: Reference element "${near}" found but has no dimensions. Proximity will be less effective.`);
                     referenceElementRect = null; // Invalidate rect if element has no size
                }
            } catch (e) {
                console.warn(`locateElement: Could not get bounding client rect for reference element "${near}". Error: ${e.message}`);
                referenceElementRect = null;
            }
        } else {
            console.warn(`locateElement: Could not find reference element for proximity search: "${near}". Proximity will not be used.`);
        }
    }

    // Helper to calculate proximity score
    function getProximityScore(targetElement, referenceRect) {
        if (!referenceRect) return 0;

        try {
            const targetRect = targetElement.getBoundingClientRect();

            // Handle cases where target element itself might be hidden or have no dimensions
            if (targetRect.width === 0 && targetRect.height === 0) {
                return 0;
            }

            // Calculate distance between closest edges
            const dx = Math.max(0, targetRect.left - referenceRect.right, referenceRect.left - targetRect.right);
            const dy = Math.max(0, targetRect.top - referenceRect.bottom, referenceRect.top - targetRect.bottom);
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > proximityThreshold) {
                return 0; // Too far
            }

            let score = 0;

            // Base score inversely proportional to distance within threshold
            // Closeness bonus: Max 50 points for being very close (distance 0), scales down to 0 at threshold
            score += (1 - (distance / proximityThreshold)) * 50;

            // Directional bonus (more points for preferred directions)
            // Example weights for common 'near' scenarios
            const directionBonuses = {
                'right': 20,
                'below': 20,
                'left': 10,
                'above': 10
            };

            for (const direction of directions) {
                if (direction === 'right' && targetRect.left >= referenceRect.right) {
                    score += directionBonuses.right;
                } else if (direction === 'below' && targetRect.top >= referenceRect.bottom) {
                    score += directionBonuses.below;
                } else if (direction === 'left' && targetRect.right <= referenceRect.left) {
                    score += directionBonuses.left;
                } else if (direction === 'above' && targetRect.bottom <= referenceRect.top) {
                    score += directionBonuses.above;
                }
            }
            // Optional: Bonus for horizontal/vertical alignment (e.g., same top/center y for 'right')
            if (Math.abs(targetRect.top - referenceRect.top) < 10 || Math.abs(targetRect.bottom - referenceRect.bottom) < 10) {
                 score += 5; // Roughly aligned horizontally
            }
            if (Math.abs(targetRect.left - referenceRect.left) < 10 || Math.abs(targetRect.right - referenceRect.right) < 10) {
                score += 5; // Roughly aligned vertically
            }

            // Avoid penalizing for small overlaps if that's acceptable
            // If there's an actual significant overlap, it might indicate parent/child or sibling elements.
            // For 'near', we usually want elements that are distinct but close.

            return Math.min(100, Math.max(0, score)); // Cap score at 100, ensure non-negative
        } catch (e) {
            console.warn(`locateElement: Error calculating proximity score for target element. Error: ${e.message}`);
            return 0;
        }
    }
    // --- NEW PROXIMITY LOGIC END ---

    // Calculate relevance score for a match
    function calculateRelevance(element, matchedSources, searchText) {
        let score = 0;

        // Weights for different text sources (higher = more relevant)
        const weights = {
            ariaLabel: 20,
            labelText: 18,
            textContent: 15,
            innerText: 15,
            placeholder: 12,
            title: 10,
            alt: 10,
            value: 8,
            ariaLabelledBy: 16,
            ariaDescribedBy: 8,
            dataLabel: 12,
            dataTitle: 8,
            dataTestId: 6,
            dataTest: 6,
            name: 5,
            id: 3,
            className: 1
        };

        // Find the best match quality among all sources
        let bestMatchQuality = 0;
        let totalWeightedScore = 0;

        matchedSources.forEach(match => {
            const sourceWeight = weights[match.sourceType] || 1;
            const qualityBonus = (match.quality / 100) * sourceWeight;
            totalWeightedScore += sourceWeight + qualityBonus;
            bestMatchQuality = Math.max(bestMatchQuality, match.quality);
        });

        score = totalWeightedScore;

        // Major bonus for high-quality matches
        if (bestMatchQuality >= 100) {
            score *= 3; // Exact matches get 3x multiplier
        } else if (bestMatchQuality >= 90) {
            score *= 2.5; // Near-exact matches get 2.5x multiplier
        } else if (bestMatchQuality >= 80) {
            score *= 2; // Good matches get 2x multiplier
        } else if (bestMatchQuality >= 60) {
            score *= 1.5; // Word boundary matches get 1.5x multiplier
        } else if (bestMatchQuality > 0) { // Any positive match quality gets at least 1x
            score *= 1;
        }

        // Bonus for exact matches when exact match is requested
        if (exactMatch && bestMatchQuality >= 100) {
            score *= 2;
        }

        // Smart type matching bonus and penalty
        const detectedType = detectElementType(element);
        if (type) { // If a specific type is provided or inferred
            if (matchesElementType(element, type)) {
                score += 25; // Strong bonus for type match
            } else {
                // If element type does NOT match the specified/inferred type,
                // apply a very strong penalty unless it's an exact text match of the search phrase.
                if (bestMatchQuality < 100) { // If it's not a perfect text match of the whole search phrase
                    score *= 0.001; // Drastic penalty for type mismatch
                } else {
                    // Even if it's an exact text match, if type doesn't match, still a minor penalty
                    // to give precedence to type-matching elements if they exist.
                    score *= 0.5;
                }
            }
        }

        // Bonus for semantic appropriateness
        if (isSemanticMatch(searchText, detectedType)) {
            score += 10;
        }

        // Bonus for interactive elements when no type specified
        if (!type && isInteractiveElement(element)) {
            score += 8;
        }

        // Bonus for visible elements
        if (!isHidden(element)) {
            score += 5;
        }

        // Penalty for hidden elements when not explicitly including them
        if (!includeHidden && isHidden(element)) {
            score *= 0.1; // Heavy penalty for hidden elements
        }

        // Penalty for very long text when search is short (less specific matches)
        if (matchedSources.length > 0) {
            const avgTextLength = matchedSources.reduce((sum, match) => sum + (match.text?.length || 0), 0) / matchedSources.length;
            const searchLength = searchText.length;

            if (avgTextLength > searchLength * 3) {
                const lengthPenalty = Math.min(0.8, avgTextLength / (searchLength * 10));
                score *= (1 - lengthPenalty);
            }
        }

        // Bonus for elements with fewer competing text sources (more specific)
        if (matchedSources.length === 1) {
            score += 5;
        }

        // NEW: Add proximity bonus if reference element was found
        if (referenceElementRect) {
            const proximityScore = getProximityScore(element, referenceElementRect);
            // Integrate proximity score into the overall relevance.
            // This adds up to 100 points, significantly boosting elements near the reference.
            score += proximityScore;
        }

        return Math.max(0, score);
    }

    // Search through all elements (only visible ones by default)
    const allElements = container.querySelectorAll('*');

    for (const element of allElements) {
        // Skip hidden elements unless explicitly requested
        if (!includeHidden && isHidden(element)) {
            continue;
        }

        // NEW: Skip the reference element itself from target matches, unless searchText explicitly matches it.
        // This prevents the "AAA" element from being returned when searching for "edit near AAA"
        if (referenceElement && element === referenceElement && normalizeText(searchText) !== normalizeText(near || '')) {
            continue;
        }


        const textSources = getElementTextSources(element);
        const matchedSources = [];

        // Check each text source for matches
        for (const [sourceType, text] of Object.entries(textSources)) {
            if (textMatches(text, searchText, exactMatch)) {
                const matchQuality = getMatchQuality(text, searchText);
                if (matchQuality > 0) { // Only add if there's a positive match quality
                    matchedSources.push({
                        sourceType,
                        text,
                        quality: matchQuality
                    });
                }
            }
        }

        // If we found matches, add to results
        if (matchedSources.length > 0) {
            const relevance = calculateRelevance(element, matchedSources, searchText);
            if (relevance > 0) { // Only include elements with a positive relevance score
                matches.push({
                    element,
                    relevance,
                    matchedSources,
                    textSources,
                    detectedType: detectElementType(element)
                });
            }
        }
    }

    // Helper function to remove parent elements when child elements exist
    function filterOutParentElements(matches) {
        const filtered = [];

        // Sort matches by DOM depth (deeper elements first) to prioritize children
        const sortedMatches = [...matches].sort((a, b) => {
            const depthA = getElementDepth(a.element);
            const depthB = getElementDepth(b.element);
            return depthB - depthA; // Deeper elements first
        });

        for (const currentMatch of sortedMatches) {
            let shouldInclude = true;

            // Check if any element already in filtered list is a descendant of current element
            for (const filteredMatch of filtered) {
                if (currentMatch.element.contains(filteredMatch.element)) {
                    // Current element is parent of already included element, skip it
                    shouldInclude = false;
                    break;
                }
                // If current element is a child of already included element, replace the parent
                // This logic is primarily for when a child has more specific "meaningful" content
                else if (filteredMatch.element.contains(currentMatch.element)) {
                    // Only replace if the child has more meaningful content than the parent
                    if (hasOwnMeaningfulContent(currentMatch.element, filteredMatch.element)) {
                        const parentIndex = filtered.indexOf(filteredMatch);
                        filtered.splice(parentIndex, 1);
                        // No break here, as the new child might be a parent to another already filtered item,
                        // though unlikely with the depth sort.
                    } else {
                        // If child doesn't have more meaningful content, stick with the parent
                        shouldInclude = false;
                        break;
                    }
                }
            }

            if (shouldInclude) {
                filtered.push(currentMatch);
            }
        }

        return filtered;
    }

    // Get DOM depth of an element
    function getElementDepth(element) {
        let depth = 0;
        let current = element;
        while (current.parentElement) {
            depth++;
            current = current.parentElement;
        }
        return depth;
    }

    // Check if child element has its own meaningful content vs inheriting from parent
    function hasOwnMeaningfulContent(childElement, parentElement) {
        // Always prefer interactive elements unless the parent is also highly interactive and more relevant overall
        if (isInteractiveElement(childElement) && !isInteractiveElement(parentElement)) {
            return true;
        }

        // Always prefer elements with specific attributes over generic containers if they have distinct content
        const childSources = getElementTextSources(childElement);
        const meaningfulSources = ['ariaLabel', 'labelText', 'placeholder', 'title', 'alt', 'value', 'dataLabel', 'dataTitle', 'dataTestId'];

        let childHasDistinctAttributes = false;
        for (const source of meaningfulSources) {
            if (childSources[source] && childSources[source].trim() && (parentElement.getAttribute(source) || '').trim() !== childSources[source].trim()) {
                childHasDistinctAttributes = true;
                break;
            }
        }

        if (childHasDistinctAttributes) {
            return true;
        }

        // Prefer semantic HTML elements over generic divs/spans
        const childTag = childElement.tagName.toLowerCase();
        const parentTag = parentElement.tagName.toLowerCase();
        const semanticTags = ['button', 'a', 'input', 'select', 'textarea', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'legend', 'li', 'td'];
        const genericTags = ['div', 'span', 'p'];

        if (semanticTags.includes(childTag) && genericTags.includes(parentTag)) {
            return true;
        }

        // If child text is significantly shorter and more specific
        const childText = (childElement.textContent || '').trim();
        const parentText = (parentElement.textContent || '').trim();

        // Check if child text is a distinct, smaller subset of parent text
        if (childText && parentText && parentText.includes(childText) && childText.length > 0 && childText.length < parentText.length * 0.5) {
            // Further check for word boundaries for more precise identification
            const regex = new RegExp(`\\b${childText.replace(/[.*+?^${}()|[\]\\]/g, '\\')}\\b`, 'i');
            if (regex.test(parentText)) {
                return true;
            }
        }

        return false;
    }


    // Remove parent elements when child elements are found
    const filteredMatches = filterOutParentElements(matches);

    // Sort by relevance (highest first) and return elements
    filteredMatches.sort((a, b) => b.relevance - a.relevance);

    // Limit results and return only elements
    return filteredMatches.slice(0, maxResults).map(match => match.element);
}

// Usage examples:
/*
// Basic usage - finds any element with matching text
const elements = locateElement('Submit');

// Disambiguate by type when multiple matches exist
const submitButton = locateElement('Submit', { type: 'button' });
const submitLink = locateElement('Submit', { type: 'link' });

// Find input field by label text
const usernameField = locateElement('Username', { type: 'input' });

// Exact match
const exactMatch = locateElement('Login', { exactMatch: true });

// Search within specific container
const modalElements = locateElement('Close', {
    container: document.querySelector('.modal'),
    type: 'button'
});

// Include hidden elements
const allMatches = locateElement('hidden-text', { includeHidden: true });

// Case sensitive search
const caseMatches = locateElement('CamelCase', { caseSensitive: true });

// New usage examples for automatic type detection from search text:
// locateElement('create button') will prioritize a button with 'create'
// locateElement('login link') will prioritize a link with 'login'
// locateElement('username input field') will prioritize an input with 'username'

// New usage examples for type detection from role, title, aria-label, placeholder:
// <div role="button" aria-label="Confirm Action"> will be detected as a button
// <span title="Go to Home"> will be semantically hinted as a link or interactive element
// <div aria-label="Search box"> will be semantically hinted as an input

// NEW: Usage examples for proximity search:
// Locate an "Edit" button near an element containing "Employee AAA"
const editButtonNearAAA = locateElement('Edit', {
    type: 'button', // Optional: specify the type of the target element
    near: 'Employee AAA', // Search for this text first to find the reference element
    proximityThreshold: 150, // Max distance in pixels (adjust as needed for your UI)
    directions: ['right', 'below'] // Prefer elements to the right or below the reference
});

// Locate a "View Details" link near a specific order number element (e.g., already found as 'orderElem')
const viewDetailsLink = locateElement('View Details', {
    type: 'link',
    near: document.getElementById('order123'), // Can pass a direct Element as 'near'
    proximityThreshold: 100
});

// Locate a "Delete" button near a table row containing a user's name
const deleteButtonNearJohn = locateElement('Delete', {
    type: 'button',
    near: 'John Doe', // Finds an element with "John Doe" and then looks for "Delete" near it
    proximityThreshold: 250, // May need larger threshold for rows
    directions: ['right'] // Assuming delete button is usually to the right in a table row
});
*/
