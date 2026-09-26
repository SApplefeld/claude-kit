---
name: csharp-style
description: "My C# house style. Use whenever writing or modifying ANY C# code: new services, handlers, helpers, MediatR notifications, models, DI registration, or refactoring existing C#. Signature traits: #region organization, section comments ending in periods, grouped fields with label comments. Trigger on any C# work even when style is not named."
---

# C# Style

Read [references/csharp-style.md](references/csharp-style.md), the full pattern reference, before writing code.

## Core Philosophy

1. **Comments are visual structure.** A short `// Title.` comment above a block is a section header marking where one thing ends and the next begins. **Every section comment ends with a period.** It states imperatively what the next block does: "Validate Parameters." not "Now we check the inputs" or "This handles the case where...". Judge intent, not vocabulary: `// Abort if we don't have a Valid VIN, make no changes.` is in-voice. A comment never explains history, decisions, alternatives weighed or issues met. Under the doctrine's prose register, a section comment is the rule alone. A WHY comment is rare, and there the reason follows as its own sentence, with at most one case. XML `/// <summary>` docs on public members are welcome when well written, never when they only restate the signature.
2. **Group related items; separate groups with whitespace and a label.**
3. **Idempotent by default.** Code never breaks on re-execution. DI registration uses `.AsImplementedInterfaces().PreserveExistingDefaults()`.
4. **Section banners over inline narration.** `#region Title` / `#endregion` organize every class.
5. **Find a sibling and mimic it.** The codebase is highly self-similar, so follow the layout of an existing file of similar shape. With no sibling, use the exemplar below and the reference's full template.

## Precedence

A repo's mechanically enforced contract, such as a committed formatter config (CSharpier, `dotnet format`), an `.editorconfig` or a CI lint gate, overrides this style. Nothing softer does. Otherwise this style is the default authority, and a legacy sibling is no authority by itself. Point 5 keeps code consistent within this style and is never a reason to abandon it in a foreign repo.

## Method Exemplar

```csharp
public async Task<Widget?> ProcessWidgetAsync(
    WidgetRequest request,
    CancellationToken cancellationToken
)
{
    // Validate Parameters.
    if (request is null) return default;

    // Return Value.
    Widget? widget = default;

    try
    {
        // Get Widget from API.
        widget = await _widgetService.GetWidgetAsync(request.Id, cancellationToken);

        // Apply Defaults.
        widget ??= new();
        widget.ProcessedAt = DateTimeOffset.UtcNow;
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Failure Processing Widget.");
    }

    // Return the Processed Widget.
    return widget;
}
```

The comments alone should tell the story of the method.

## Outlining a large file

To find one thing in a C# file past roughly 1,000 lines, take the outline in three greps rather than reading it, each with line numbers:

- Types: `^\s*((public|private|protected|internal|sealed|static|abstract|partial|readonly|file)\s+)*(class|interface|record|struct|enum)\s+\w`
- Members: `^\s*(public|private|protected|internal)\b.*\(`, piped through `grep -vE '^[^(]*= '` and `grep -v '{ get'`
- Regions: `^\s*#region`, taken verbatim

Three details fail quietly. Keep the member pattern's `\b`: without it `^\s*(public).*\(` matches `publicKey.Validate(id);`, and neither filter removes that. Anchor the member filter before the paren. A bare `grep -v '= '` drops every method with a default parameter value, such as this style's own `CancellationToken cancellationToken = default`. Keep the type pattern's modifier group optional. A nested class with no modifier is legal and implicitly private (only a top-level type defaults to internal), and requiring a modifier drops it, leaving one owner for two types.

Interface members carry no access modifier, so on an interface file the member grep silently finds none. There, take members with `^[[:space:]]+[A-Za-z_][^;=]*[[:space:]]+[A-Za-z_][A-Za-z0-9_<>]*[[:space:]]*\(` instead. Never use that on a class file, where it cannot tell a declaration from a call. A modifier-less class member is implicitly private and equally invisible to the anchored grep.

A positional record or primary constructor appears in both the type and member lists. Read the repeat as confirmation, not two things. Take `#region` labels verbatim, never summarized. They carry intent and spec cross-references the code never states, and in canonical region order they are the whole map.

## Antipatterns

- ❌ Block-scoped namespaces in *new* files - a new file that declares a namespace uses file-scoped (`namespace X;`), and existing block-scoped files are left alone
- ❌ Fine-grained namespaces - keep them coarse and minimal, since many files declare none and plugin assemblies use the global namespace, and never map folders to sub-namespaces
- ❌ Change-narrative comments ("Updated to...", "Now we...", "per the new spec") - the doctrine's current-state rule applies: a comment states what the code does now, never the session, the change, or the prior version
- ❌ Removing `#region` blocks because "modern style" dislikes them
- ❌ The null-forgiving operator `!` - use null-conditional and null-coalescing instead
- ❌ Inline SQL text in application code - data access goes through stored procedures (`CommandType.StoredProcedure`)
- ❌ Resolving configuration options once at startup instead of lazily at request time
- ❌ Ordering middleware by convenience rather than cost - cheap rejection (rate limiting) belongs before expensive work (authentication)

## Completion Checklist

- [ ] Each major section wrapped in `#region` / `#endregion`; canonical order: Constants → Variables → Constructor → public method-group regions → Private Methods
- [ ] Private fields `_camelCase`, `readonly` for injected dependencies, grouped with `// Group.` labels
- [ ] Constructor parameters one per line (8-space indent) when 2+, closing `)` on its own line, body starts `// Save Services.`
- [ ] Section comments inside methods use `// Title.` with terminating period, never `// Save Services`; blank line before each
- [ ] Early returns with `default` (not `null`); `is null` / `is not null`; `??=` for late-init
- [ ] Collection expressions and spreads: `[.. source.Where(...)]` not `.ToArray()`, `[item]` not `new[] { item }`, `[.. existing, item]` not `Append`/`Concat` + `ToArray`
- [ ] `Async` suffix on every `Task` and `Task<T>` method; `CancellationToken` last in the parameter list and passed down the chain
- [ ] `using` lines: System.* first, then project and third-party namespaces, third-party where convenient (reference §1), no blank lines between groups; no file-header comments
- [ ] Logging via `ILogger<T>` (preferred) or the static Serilog `Log` (common in existing code); messages end with a period: `logger.LogError(ex, "Message.")` or `Log.Error(ex, "Message.")`
- [ ] DI registration in `Assembly/RegisterServices.cs`: `.AsImplementedInterfaces().PreserveExistingDefaults()`, grouped by domain label
- [ ] Class declares its interface inline: `public class FooService : IFooService`; interface in `Interfaces/IFooService.cs`
- [ ] XML `/// <summary>` docs on public members only where they earn their keep, never boilerplate
