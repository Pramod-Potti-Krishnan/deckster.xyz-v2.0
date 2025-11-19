# Issues and Fixes

Troubleshooting guides, known issues, and documented bug fixes.

## Available Documentation

- [Strawman Loop Issue](strawman-loop.md) - Director service regeneration loop
- [Preview ID Fix](preview-presentation-id.md) - Google Slides preview issues
- [Authentication Issues](authentication.md) - OAuth and session problems
- [WebSocket Disconnections](websocket-disconnections.md) - Connection stability fixes

## Issue Categories

### Critical Issues
High-priority problems affecting core functionality:
- WebSocket disconnections
- Authentication failures
- Data loss or corruption

### Known Issues
Documented problems with workarounds:
- UI glitches with known fixes
- Performance issues
- Browser compatibility

### Fixed Issues
Historical problems that have been resolved:
- Root cause analysis
- Solution implemented
- Prevention measures

## Troubleshooting Workflow

When encountering an issue:

1. **Search This Section**: Check if the issue is documented
2. **Check Console**: Look for error messages in browser console
3. **Review Logs**: Check application logs for backend errors
4. **Isolate**: Try to reproduce in a minimal environment
5. **Document**: If new, document the issue and fix

## Common Issues Quick Reference

### WebSocket Not Connecting
**Symptoms**: Connection status shows "disconnected"
**Check**:
- Network tab in DevTools
- WebSocket URL is correct
- Backend service is running
- CORS configuration

**Fix**: See [websocket-disconnections.md](websocket-disconnections.md)

### Authentication Failing
**Symptoms**: Redirect loops, session not persisting
**Check**:
- NEXTAUTH_SECRET is set
- NEXTAUTH_URL matches domain
- OAuth redirect URIs configured
- Database connection

**Fix**: See [authentication.md](authentication.md)

### Presentation Not Loading
**Symptoms**: Blank canvas, no slides
**Check**:
- Session ID is valid
- Database contains presentation data
- API calls succeeding
- Console errors

**Fix**: See [preview-presentation-id.md](preview-presentation-id.md)

### Messages Not Appearing
**Symptoms**: Chat messages sent but not visible
**Check**:
- WebSocket connection active
- Message deduplication logic
- State updates occurring
- Sort order of messages

**Fix**: Review message handling in `/app/builder/page.tsx`

## Reporting New Issues

When documenting a new issue:

1. **Title**: Clear, descriptive title
2. **Summary**: Brief description of the problem
3. **Environment**: Browser, OS, deployment platform
4. **Steps to Reproduce**: Exact steps to trigger the issue
5. **Expected Behavior**: What should happen
6. **Actual Behavior**: What actually happens
7. **Error Messages**: Console logs, stack traces
8. **Fix**: If resolved, document the solution
9. **Prevention**: How to prevent in the future

## Issue Template

```markdown
# [Issue Title]

## Summary
Brief description of the issue.

## Environment
- Browser: [Chrome/Firefox/Safari]
- OS: [macOS/Windows/Linux]
- Deployment: [Local/Vercel/Railway]
- Version: [Git commit hash]

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Error Messages
```
[Console logs or error messages]
```

## Root Cause
Technical explanation of why the issue occurs.

## Fix
How the issue was resolved.

## Prevention
Measures to prevent recurrence.

---
Date: YYYY-MM-DD
Status: [Open/In Progress/Fixed]
```

---

[Back to Documentation Index](../README.md)
