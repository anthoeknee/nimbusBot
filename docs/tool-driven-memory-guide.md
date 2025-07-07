# Tool-Driven Memory System Guide

## Overview

The Tool-Driven Memory System transforms the Discord bot from **automatic memory creation** to **intentional, AI-controlled memory management**. Instead of automatically saving conversations to long-term memory when thresholds are reached, the AI now makes deliberate decisions about what information is worth preserving and how it should be structured.

## Key Concepts

### Automatic vs Tool-Driven Memory

| Aspect | Automatic Mode | Tool-Driven Mode |
|--------|----------------|------------------|
| **Memory Creation** | Threshold-based, automatic | AI-decided, intentional |
| **Content Quality** | All conversation content | Curated, important information |
| **Organization** | Basic timestamps and context | Structured categories and metadata |
| **AI Control** | Limited | Complete control over memory operations |
| **Memory Efficiency** | High volume, varied quality | Lower volume, high quality |

### Benefits of Tool-Driven Memory

1. **Quality Over Quantity**: Only important information is preserved
2. **Intelligent Curation**: AI decides what's worth remembering and why
3. **Better Organization**: Structured categories and meaningful metadata
4. **Context Awareness**: Memory decisions based on conversation significance
5. **Resource Efficiency**: Reduced storage and improved search relevance

## Enabling Tool-Driven Mode

### Quick Start

Use the `enable_tool_driven_mode` tool to quickly switch to tool-driven memory:

```json
{
  "name": "enable_tool_driven_mode",
  "parameters": {
    "memoryDecisionThreshold": 6.0,
    "preserveExistingMemories": true,
    "reason": "Switching to intelligent memory management"
  }
}
```

This will:
- Enable tool-driven mode
- Disable automatic memory transfer
- Set up optimal permissions
- Preserve existing conversation contexts

### Manual Configuration

For more control, use `configure_memory_system`:

```json
{
  "name": "configure_memory_system",
  "parameters": {
    "enableToolDrivenMemory": true,
    "disableAutoTransfer": true,
    "memoryDecisionThreshold": 6.0,
    "enableMemoryAnalytics": true,
    "intelligentMemoryFiltering": true,
    "reason": "Custom tool-driven setup"
  }
}
```

## Available Tools

### Core Memory Tools

#### 1. `analyze_conversation_for_memory`
Analyzes current conversation to determine if it contains information worth saving.

**Use When:**
- Evaluating conversation significance before saving
- Understanding what makes content memorable
- Getting AI recommendations for memory decisions

**Example:**
```json
{
  "name": "analyze_conversation_for_memory",
  "parameters": {
    "messageCount": 15,
    "contextType": "channel",
    "contextId": "123456789",
    "includeSystemMessages": false
  }
}
```

**Response Analysis:**
- `shouldSave`: Boolean recommendation
- `importance`: Score 1-10
- `category`: Suggested memory category
- `reasoning`: Why it should/shouldn't be saved
- `extractedFacts`: Key facts from conversation
- `suggestedTags`: Recommended tags

#### 2. `save_structured_memory`
Saves curated information with enhanced categorization and metadata.

**Use When:**
- You've decided something is worth remembering
- Organizing information by specific categories
- Creating memories with relationships and context

**Example:**
```json
{
  "name": "save_structured_memory",
  "parameters": {
    "content": "User prefers dark mode UI and dislikes bright colors",
    "category": "user_preference",
    "importance": 7,
    "facts": ["prefers dark mode", "dislikes bright colors"],
    "relationships": ["UI preferences", "user comfort"],
    "userId": 12345,
    "tags": ["UI", "preferences", "accessibility"],
    "priority": "high"
  }
}
```

#### 3. `search_long_term_memory`
Enhanced memory search with intelligent ranking and purpose-based filtering.

**Use When:**
- Looking for relevant past information
- Understanding user preferences or history
- Finding solutions to similar problems

**Example:**
```json
{
  "name": "search_long_term_memory",
  "parameters": {
    "query": "user interface preferences",
    "purpose": "Customizing UI recommendations for user",
    "topK": 5,
    "categories": ["user_preference", "decision"],
    "includeReasoning": true
  }
}
```

### Advanced Memory Tools

#### 4. `get_memory_insights`
Get intelligent insights about memories related to a query.

**Use When:**
- Understanding patterns in saved information
- Getting recommendations for memory organization
- Analyzing memory relationships and themes

#### 5. `manual_memory_transfer`
Manually transfer current conversation to long-term memory with custom options.

**Use When:**
- Preserving entire conversation context
- Saving conversations that didn't meet automatic thresholds
- Creating comprehensive memory records

#### 6. `consolidate_memories`
Intelligently consolidate similar memories to reduce redundancy.

**Use When:**
- Optimizing memory storage
- Removing duplicate information
- Improving memory organization

### Configuration Tools

#### 7. `get_memory_configuration`
View current memory system settings and permissions.

#### 8. `set_memory_permissions`
Configure what memory operations are allowed.

#### 9. `validate_memory_configuration`
Check configuration validity and get optimization recommendations.

## Memory Categories

The system supports structured categorization:

| Category | Description | Use Cases |
|----------|-------------|-----------|
| `user_preference` | User likes, dislikes, settings | UI preferences, communication style |
| `important_fact` | Key factual information | Personal details, capabilities |
| `decision` | Decisions made or preferences stated | Project choices, feature decisions |
| `relationship` | Information about relationships | Team dynamics, user connections |
| `event` | Significant events or milestones | Achievements, important moments |
| `knowledge` | General knowledge or insights | Learning, discoveries |
| `reminder` | Future-oriented information | Deadlines, follow-ups |
| `context` | Background or situational info | Project context, environment |
| `problem_solution` | Solutions to problems | Technical fixes, workarounds |
| `insight` | Realizations or understanding | Patterns, conclusions |

## Best Practices for AI Decision-Making

### When to Save Memories

**High Priority (Importance 8-10):**
- User preferences and settings
- Important decisions or commitments
- Critical facts about users or projects
- Solutions to significant problems
- Key insights or realizations

**Medium Priority (Importance 5-7):**
- Helpful information that might be referenced later
- Interesting facts or knowledge
- Moderate preferences or opinions
- Context that adds understanding

**Low Priority (Importance 1-4):**
- General conversation flow
- Temporary information
- Common knowledge
- Easily replaceable context

### Memory Decision Framework

1. **Assess Permanence**: Will this information be relevant in the future?
2. **Evaluate Uniqueness**: Is this information unique to this user/context?
3. **Consider Utility**: Would remembering this improve future interactions?
4. **Check Significance**: Does this represent an important moment or decision?
5. **Analyze Relationships**: Does this connect to other important information?

### Reasoning Guidelines

When saving memories in tool-driven mode, always provide reasoning:

**Good Reasoning Examples:**
- "User explicitly stated their preference for dark mode interfaces"
- "Important decision about project architecture that affects future development"
- "Solution to a complex problem that took significant effort to resolve"
- "Key insight about user behavior patterns that improves personalization"

**Poor Reasoning Examples:**
- "Conversation happened"
- "User said something"
- "Might be useful"
- "General information"

## Migration from Automatic Mode

### Step 1: Analyze Current Memory Usage
```json
{
  "name": "get_conversation_stats",
  "parameters": {
    "includeAnalytics": true,
    "includeConfig": true
  }
}
```

### Step 2: Validate Current Configuration
```json
{
  "name": "validate_memory_configuration",
  "parameters": {
    "includeRecommendations": true,
    "checkConsistency": true
  }
}
```

### Step 3: Enable Tool-Driven Mode
```json
{
  "name": "enable_tool_driven_mode",
  "parameters": {
    "memoryDecisionThreshold": 6.0,
    "preserveExistingMemories": true,
    "reason": "Migrating to intelligent memory management"
  }
}
```

### Step 4: Review and Optimize
After migration, use memory analytics to understand the impact:
```json
{
  "name": "get_memory_analytics",
  "parameters": {}
}
```

## Troubleshooting

### Common Issues

#### Memory Not Being Saved
**Symptoms:** Memories aren't being created despite using save tools
**Solutions:**
1. Check permissions: `get_memory_configuration`
2. Verify importance threshold
3. Ensure tool-driven mode is enabled
4. Check for validation errors

#### Too Many/Few Memories
**Symptoms:** Memory volume doesn't match expectations
**Solutions:**
1. Adjust `memoryDecisionThreshold`
2. Review memory categorization
3. Use `consolidate_memories` to reduce redundancy
4. Analyze conversation patterns

#### Search Results Poor Quality
**Symptoms:** Memory searches return irrelevant results
**Solutions:**
1. Use more specific search queries
2. Include `purpose` parameter in searches
3. Filter by categories
4. Increase `minSimilarity` threshold

### Configuration Validation

Always validate your configuration after changes:
```json
{
  "name": "validate_memory_configuration",
  "parameters": {
    "includeRecommendations": true,
    "checkConsistency": true
  }
}
```

### Memory System Health Check

Regular health checks help maintain optimal performance:
```json
{
  "name": "get_memory_insights",
  "parameters": {
    "query": "system health",
    "includeRelationships": true,
    "timeRange": "month"
  }
}
```

## Advanced Features

### Memory Relationships
Tool-driven mode supports memory relationships for complex information networks:
- Related facts and decisions
- Connected user preferences
- Problem-solution pairs
- Context dependencies

### Intelligent Filtering
The system automatically filters and ranks memories based on:
- Semantic similarity
- Importance scores
- Access patterns
- Recency factors
- Purpose alignment

### Analytics and Insights
Get detailed analytics about memory usage patterns:
- Category distributions
- Importance trends
- Access patterns
- Tool-driven vs automatic memory ratios

## Configuration Reference

### Key Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `enableToolDrivenMemory` | `false` | Enable tool-driven mode |
| `disableAutoTransfer` | `false` | Disable automatic transfers |
| `memoryDecisionThreshold` | `6.0` | Minimum importance for tool decisions |
| `maxRelevantMemories` | `8` | Max memories to retrieve |
| `memoryRelevanceThreshold` | `0.65` | Similarity threshold for retrieval |
| `intelligentMemoryFiltering` | `true` | Enable smart filtering |

### Permissions

| Permission | Default | Description |
|------------|---------|-------------|
| `allowSave` | `true` | Allow saving new memories |
| `allowSearch` | `true` | Allow searching memories |
| `allowDelete` | `false` | Allow deleting memories |
| `allowConsolidate` | `true` | Allow memory consolidation |
| `allowAnalytics` | `true` | Allow analytics access |

## Examples

### Complete Workflow Example

1. **Analyze Conversation:**
```json
{
  "name": "analyze_conversation_for_memory",
  "parameters": {
    "messageCount": 10,
    "contextType": "user",
    "contextId": "12345"
  }
}
```

2. **Save Important Information:**
```json
{
  "name": "save_structured_memory",
  "parameters": {
    "content": "User is working on React project and prefers TypeScript for type safety",
    "category": "knowledge",
    "importance": 7,
    "facts": ["working on React project", "prefers TypeScript", "values type safety"],
    "userId": 12345,
    "tags": ["React", "TypeScript", "development", "preferences"]
  }
}
```

3. **Search for Related Information:**
```json
{
  "name": "search_long_term_memory",
  "parameters": {
    "query": "React TypeScript development",
    "purpose": "Providing relevant development assistance",
    "categories": ["knowledge", "user_preference"],
    "topK": 5
  }
}
```

This guide provides comprehensive coverage of the tool-driven memory system. Start with the Quick Start section and gradually explore advanced features as needed.
