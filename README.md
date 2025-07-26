# Smart Element Finder

A powerful JavaScript library for intelligently locating DOM elements using natural language text searches with advanced proximity detection and semantic matching.

## Introduction

Smart Element Finder solves the common problem of reliably finding DOM elements in web applications, especially when dealing with dynamic content, accessibility features, or complex UI layouts. Unlike traditional selectors that rely on fragile CSS selectors or XPath expressions, this library uses intelligent text matching combined with semantic understanding and proximity-based searches.

## Description

The Smart Element Finder provides robust element location capabilities through:

- **Natural Language Search**: Find elements using human-readable text descriptions
- **Semantic Type Detection**: Automatically infer element types (buttons, links, inputs) from search text
- **Multi-Source Text Matching**: Searches across multiple text sources including:
  - Text content and inner text
  - ARIA labels and descriptions
  - Form labels and placeholders
  - Data attributes and titles
  - Alt text and names
- **Proximity-Based Search**: Locate elements relative to other elements using spatial relationships
- **Intelligent Scoring**: Advanced relevance scoring that considers match quality, element type, and proximity
- **Accessibility-Aware**: Full support for ARIA attributes and semantic HTML
- **Flexible Configuration**: Extensive options for fine-tuning search behavior

## Installation

### Direct Include

Simply include the `locateElement.js` file in your project:

```html
<script src="path/to/locateElement.js"></script>
```

### Module Import

If using ES6 modules, you can import the function:

```javascript
import { locateElement } from './locateElement.js';
```

### Node.js Environment

For Node.js with jsdom or similar DOM implementations:

```javascript
const { locateElement } = require('./locateElement.js');
```

## Usage

### Basic Syntax

```javascript
const elements = locateElement(searchText, options);
```

### Parameters

- **searchText** (string, required): The text to search for
- **options** (object, optional): Configuration options

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | null | Preferred element type ('button', 'link', 'input', etc.) |
| `exactMatch` | boolean | false | Whether to use exact text matching |
| `caseSensitive` | boolean | false | Whether matching should be case sensitive |
| `container` | Element | document | Container element to search within |
| `maxResults` | number | 10 | Maximum number of results to return |
| `includeHidden` | boolean | false | Whether to include hidden elements |
| `near` | string\|Element | null | Reference element/text for proximity search |
| `proximityThreshold` | number | 200 | Maximum distance in pixels for proximity |
| `directions` | string[] | ['right', 'below', 'left', 'above'] | Preferred directions for proximity |

### Return Value

Returns an array of DOM elements sorted by relevance score (most relevant first).

## Examples

### Basic Element Finding

```javascript
// Find any element containing "Submit"
const elements = locateElement('Submit');

// Find the first submit button
const submitButton = locateElement('Submit', { type: 'button' });

// Find a login link specifically
const loginLink = locateElement('Login', { type: 'link' });
```

### Form Field Location

```javascript
// Find username input field by label
const usernameField = locateElement('Username', { type: 'input' });

// Find email field with exact matching
const emailField = locateElement('Email Address', { 
    type: 'input', 
    exactMatch: true 
});

// Find any form field related to password
const passwordField = locateElement('Password', { type: 'field' });
```

### Automatic Type Detection

The library can automatically detect element types from search text:

```javascript
// Automatically looks for button elements
const createButton = locateElement('create button');

// Automatically looks for link elements  
const homeLink = locateElement('home link');

// Automatically looks for input elements
const searchInput = locateElement('search input field');
```

### Advanced Text Matching

```javascript
// Case-sensitive search
const caseMatch = locateElement('CamelCase', { caseSensitive: true });

// Search within specific container
const modalButton = locateElement('Close', {
    container: document.querySelector('.modal'),
    type: 'button'
});

// Include hidden elements in search
const hiddenElements = locateElement('hidden-content', { 
    includeHidden: true 
});
```

### Proximity-Based Search

Find elements near other elements using spatial relationships:

```javascript
// Find "Edit" button near "Employee AAA" text
const editButton = locateElement('Edit', {
    type: 'button',
    near: 'Employee AAA',
    proximityThreshold: 150,
    directions: ['right', 'below']
});

// Find "Delete" button near a specific element
const orderElement = document.getElementById('order-123');
const deleteButton = locateElement('Delete', {
    type: 'button',
    near: orderElement,
    proximityThreshold: 100,
    directions: ['right']
});

// Find "View Details" link in a table row
const viewLink = locateElement('View Details', {
    type: 'link',
    near: 'John Doe', // Find row containing this name
    proximityThreshold: 250,
    directions: ['right'] // Look to the right in the table
});
```

### Real-World Scenarios

#### E-commerce Product Actions

```javascript
// Find "Add to Cart" button for a specific product
const addToCartButton = locateElement('Add to Cart', {
    type: 'button',
    near: 'iPhone 15 Pro',
    proximityThreshold: 200,
    directions: ['below', 'right']
});

// Find quantity input near product name
const quantityInput = locateElement('Quantity', {
    type: 'input',
    near: 'Samsung Galaxy S24',
    proximityThreshold: 150
});
```

#### Form Interactions

```javascript
// Find submit button in contact form
const contactSubmit = locateElement('Send Message', {
    type: 'button',
    container: document.querySelector('#contact-form')
});

// Find field next to label
const phoneField = locateElement('Phone Number', {
    type: 'input',
    near: 'Phone:', // Find the label first
    proximityThreshold: 50,
    directions: ['right', 'below']
});
```

#### Navigation and UI

```javascript
// Find menu items
const profileMenu = locateElement('Profile', {
    type: 'link',
    container: document.querySelector('nav')
});

// Find modal close button
const closeModal = locateElement('Close', {
    type: 'button',
    container: document.querySelector('.modal'),
    directions: ['above', 'right'] // Usually top-right corner
});
```

### Error Handling

```javascript
try {
    const elements = locateElement('Search Text');
    if (elements.length === 0) {
        console.log('No elements found');
    } else {
        console.log(`Found ${elements.length} matching elements`);
        // Use first (most relevant) element
        elements[0].click();
    }
} catch (error) {
    console.error('Search failed:', error.message);
}
```

### Best Practices

1. **Be Specific**: Use descriptive text that uniquely identifies your target element
2. **Use Type Hints**: Specify element types when multiple matches are possible
3. **Leverage Proximity**: Use the `near` option for complex layouts where text alone isn't sufficient
4. **Start Broad, Then Narrow**: Begin with general searches and add constraints as needed
5. **Test Different Directions**: Adjust proximity directions based on your UI layout
6. **Handle Multiple Results**: Always check if multiple elements are returned and handle appropriately

### Integration with Testing Frameworks

#### Selenium WebDriver

```javascript
// Custom Selenium command
driver.executeScript(`
    const elements = locateElement('${searchText}', ${JSON.stringify(options)});
    return elements.length > 0 ? elements[0] : null;
`).then(element => {
    if (element) {
        driver.executeScript('arguments[0].click();', element);
    }
});
```

#### Puppeteer

```javascript
// Puppeteer page evaluation
const element = await page.evaluate((searchText, options) => {
    const elements = locateElement(searchText, options);
    return elements.length > 0 ? elements[0] : null;
}, searchText, options);

if (element) {
    await element.click();
}
```

#### Playwright

```javascript
// Playwright custom locator
const customLocator = page.locator('*').evaluateAll((elements, searchText) => {
    return locateElement(searchText);
}, searchText);
```

## Browser Compatibility

- Chrome/Chromium 60+
- Firefox 55+
- Safari 11+
- Edge 79+
- Internet Explorer 11+ (with polyfills for modern JavaScript features)

## Performance Considerations

- The library searches through all DOM elements, so performance scales with DOM size
- Use the `container` option to limit search scope when possible
- Consider using `maxResults` to limit the number of returned elements
- Proximity calculations add computational overhead but provide more accurate results

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the Smart Element Finder library.

## License

This project is open source and available under the [MIT License](LICENSE).

---

**Smart Element Finder** - Making DOM element location intelligent and intuitive.
