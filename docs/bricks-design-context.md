# Bricks Design Context

Where Bricks stores CSS classes, variables, and colors - and how to retrieve them.

## WordPress Options

Bricks stores design data in these WordPress options:

| Option | Description |
|--------|-------------|
| `bricks_global_classes` | Global CSS classes |
| `bricks_global_classes_categories` | Class categories |
| `bricks_global_variables` | CSS variables |
| `bricks_global_variables_categories` | Variable categories |
| `bricks_color_palette` | Color palette |
| `bricks_theme_styles` | Theme styles |

## Retrieving Data

### PHP

```php
$global_classes = get_option('bricks_global_classes', array());
$global_variables = get_option('bricks_global_variables', array());
$color_palette = get_option('bricks_color_palette', array());
```

### Global Classes Structure

```php
[
  [
    'id' => 'abc123',
    'name' => 'headline-xl',
    'settings' => [
      '_typography' => [
        'font-size' => '3rem',
        'font-weight' => '700'
      ]
    ]
  ]
]
```

### Global Variables Structure

```php
[
  [
    'id' => 'xyz789',
    'name' => 'primary',
    'value' => '#3b82f6'
  ]
]
```

### Color Palette Structure

```php
[
  [
    'id' => 'color1',
    'name' => 'Primary',
    'raw' => '#3b82f6'
  ]
]
```

## Bricks Admin Locations

- **Global Classes**: Bricks > Settings > Global Classes
- **CSS Variables**: Bricks > Settings > Global Variables
- **Color Palette**: Bricks > Settings > Color Palette
- **Theme Styles**: Bricks > Settings > Theme Styles
