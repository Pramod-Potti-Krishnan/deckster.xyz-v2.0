# Archive

Deprecated documentation, outdated guides, and historical content.

## Purpose

This archive contains documentation that is no longer current but preserved for historical reference:
- Deprecated features and APIs
- Outdated integration guides
- Historical screenshots
- Old planning documents
- Superseded implementations

## What Gets Archived

Documents are archived when:
- Feature has been removed or replaced
- API version is no longer supported
- Guide has been superseded by newer version
- Screenshots show outdated UI
- Planning doc has been completed or cancelled

## Archive Structure

```
archive/
├── old-integration-guides.md    # Superseded integration docs
├── screenshots/                 # Historical UI screenshots
├── old-plans/                   # Completed or cancelled plans
└── deprecated/                  # Removed features
```

## Using Archived Content

Archived content may still be useful for:
- Understanding historical context
- Migration from old versions
- Learning why decisions were made
- Reference for similar future work

## Archive Guidelines

When archiving a document:
1. Add "ARCHIVED" prefix to filename
2. Add archive date to document header
3. Include reason for archiving
4. Link to replacement document (if applicable)
5. Remove from main documentation index
6. Add entry to this README

## Archived Documents

### Integration Guides
- **old-integration-guides.md**: Pre-v3.4 Director integration (Replaced by current integration guide)
- **frontend-integration-guide.md**: Original integration guide (Superseded by v3.4)

### Screenshots
- Various UI screenshots from early development phases
- Outdated design mockups

### Planning Documents
- Completed feature specifications
- Cancelled project proposals

## Accessing Archived Content

All archived content remains in Git history. To access:
```bash
# View file from specific commit
git show <commit-hash>:path/to/file.md

# View file history
git log -- path/to/file.md
```

## Retention Policy

Archived content is retained indefinitely in the repository but:
- Not included in main documentation navigation
- Not maintained or updated
- May contain outdated or incorrect information
- Should not be used for current development

---

**Note**: Always refer to current documentation in parent directories. Only consult archived content for historical context.

[Back to Documentation Index](../README.md)
