---
name: csharp-style
description: "My C# house style. Use whenever writing or modifying ANY C# code: new services, handlers, helpers, MediatR notifications, models, DI registration, or refactoring existing C#. Signature traits: #region organization, section comments ending in periods, grouped fields with label comments. Trigger on any C# work even when style is not named."
---

# C# Style

My personal C# style. Internalize the philosophy, then consult [references/csharp-style.md](references/csharp-style.md) for the detailed pattern reference (full file/class anatomy, all 16 sections, complete service template) before writing code.

## Core philosophy

1. **Comments are visual structure.** Short `// Title.` comments above blocks act as section headers - they mark where one thing ends and another begins. **Every section comment ends with a period.** A comment is a short, imperative, direct statement of what the next block is intended to do - a reading aid for someone scanning the method: "Validate Parameters." not "Now we check the inputs". The test is intent, not vocabulary: `// Abort if we don't have a Valid VIN, make no changes.` is in-voice. A comment never explains history, decision-making, alternatives weighed, or issues encountered; a WHY comment is rare and exceptional. These section labels are for in-method structure; XML `/// <summary>` docs on public members are a separate, complementary tool - good when written well, and worth skipping when they would only restate the signature.
2. **Group related items; separate groups with whitespace and a label.** A Variables region holds `// Values.`, `// Mapper.`, `// Services.` groups with blank lines between.
3. **Idempotent by default.** DI registration uses `.AsImplementedInterfaces().PreserveExistingDefaults()`. Code never breaks on re-execution.
4. **Section banners over inline narration.** `#region Title` / `#endregion` organize every class.
5. **Find a sibling and mimic it.** The codebase is highly self-similar. When in doubt, find an existing file solving a similar shape and follow its layout exactly. In greenfield repos with no sibling, use the exemplar below and the full template in the reference.

## Precedence

A repo's mechanically-enforced contract wins first: a committed formatter config (CSharpier, `dotnet format`), an `.editorconfig`, or a CI lint gate overrides this style, nothing softer does. Absent that, this style is the default authority, and a legacy sibling is not authority on its own. Philosophy point 5 (mimic a sibling) is for staying consistent inside code already written in this style, not a reason to abandon it in a foreign repo.

## Exemplar (the shape of every method)

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

The comments alone tell the story of the method. That is the goal.

## Outlining a large file

When you are opening a C# file past roughly 1,000 lines to find one thing, take the outline in three greps rather than reading it, each run with line numbers:

- Types: `^\s*((public|private|protected|internal|sealed|static|abstract|partial|readonly|file)\s+)*(class|interface|record|struct|enum)\s+\w`
- Members: `^\s*(public|private|protected|internal)\b.*\(`, piped through `grep -vE '^[^(]*= '` and `grep -v '{ get'`
- Regions: `^\s*#region`, taken verbatim

Three details are load-bearing, and each of them fails quietly rather than loudly. The member pattern's `\b` is what keeps an ordinary body statement out: without it `^\s*(public).*\(` matches a line reading `publicKey.Validate(id);`, and neither filter removes that. The identifier has to open with a modifier's own letters for the collision to happen, so the shape is rarer than it looks rather than absent, and the boundary costs nothing to keep. The member filter has to anchor before the paren, because the obvious mechanization is a bare `grep -v '= '` and that destroys every method carrying a default parameter value: on a 4,347-line API client it took out 32 real signatures, `CancellationToken cancellationToken = default` being the idiom this very style mandates. And the type pattern's modifier group has to be optional, since a nested class with no modifier is legal and takes the implicit private accessibility (only a top-level type defaults to internal); requiring a modifier dropped `class RateLimitedClient` out of a 3,290-line service, leaving an outline with one owner for two types.

The fourth detail is a hole rather than a subtlety, and it is stated because the member grep gives no sign of it. That grep is anchored on an access modifier, and an interface's members carry none, so on an interface file it returns nothing at all and the outline presents as one type with no members: measured, an 885-line service interface returns zero members under it while carrying 67. Where the type grep tells you the file is an interface, take the members with `^[[:space:]]+[A-Za-z_][^;=]*[[:space:]]+[A-Za-z_][A-Za-z0-9_<>]*[[:space:]]*\(` instead, which finds all 67 there. Do not reach for that one on an ordinary class file, where it cannot tell a declaration from a call and returns 262 lines against 202 real members. The same hole swallows a modifier-less member of a class, which is implicitly private and equally invisible to the anchored pattern.

The type and member greps overlap rather than partition, since a positional record or a primary constructor puts a paren on its own declaration line and so appears in both lists. Read the repeat as confirmation rather than as two things. Take the `#region` labels verbatim rather than summarizing them: this style makes them the section structure, so they carry the author intent and the spec cross-references the code itself never states, and on a file organized to the canonical region order the completion checklist names, they are the whole map.

## Antipatterns (common AI habits that violate the style)

- ❌ Block-scoped namespaces in *new* files - when a new file declares a namespace at all, it is file-scoped (`namespace X;`); leave existing block-scoped files alone. Many files declare none: namespaces are coarse and minimal (plugin assemblies use the global namespace, one root namespace per project where warranted), and folders never map to sub-namespaces
- ❌ Apologetic/explanatory comments ("This handles the case where...") - comments are imperative section labels
- ❌ Change-narrative comments ("Updated to...", "Now we...", "per the new spec") - the doctrine's current-state rule applies: a comment states what the code does now, never the session, the change, or the prior version
- ❌ Section comments without a terminating period - `// Save Services` is wrong; `// Save Services.` is correct
- ❌ `Task<T>` methods without the `Async` suffix
- ❌ `CancellationToken` anywhere but last in the parameter list
- ❌ Removing `#region` blocks because "modern style" dislikes them - they are core to this organization
- ❌ The null-forgiving operator `!` - use null-conditional and null-coalescing instead
- ❌ Inline SQL text in application code - data access goes through stored procedures (`CommandType.StoredProcedure`); the connection's principal is EXECUTE-only by design, so inline SQL is an architecture violation, not a shortcut
- ❌ Resolving configuration options once at startup instead of lazily at request time - an eager startup read bakes in defaults and silently bypasses test overrides
- ❌ Ordering middleware by convenience rather than cost - cheap rejection (rate limiting) belongs before expensive work (authentication)

## Checklist before declaring C# work complete

- [ ] Each major section wrapped in `#region` / `#endregion`; canonical order: Constants → Variables → Constructor → public method-group regions → Private Methods
- [ ] Private fields `_camelCase`, `readonly` for injected dependencies, grouped with `// Group.` labels
- [ ] Constructor parameters one per line (8-space indent) when 2+, closing `)` on its own line, body starts `// Save Services.`
- [ ] Section comments inside methods use `// Title.` with terminating period; blank line before each
- [ ] Early returns with `default` (not `null`); `is null` / `is not null`; `??=` for late-init
- [ ] Collection expressions and spreads over older constructions: `[.. source.Where(...)]` not `.ToArray()`, `[item]` not `new[] { item }`, `[.. existing, item]` not `Append`/`Concat` + `ToArray`
- [ ] Async suffix on all `Task` methods; `CancellationToken` last and passed down the chain
- [ ] `using` lines: System.* first; project and third-party namespaces follow, third-party placed where convenient (reference §1) - no blank lines between groups; no file-header comments
- [ ] Logging via `ILogger<T>` (the preferred pattern) or the static Serilog `Log` (common in existing code); messages end with a period, e.g. `logger.LogError(ex, "Message.")` or `Log.Error(ex, "Message.")`
- [ ] DI registration in `Assembly/RegisterServices.cs`: `.AsImplementedInterfaces().PreserveExistingDefaults()`, grouped by domain label
- [ ] Class declares its interface inline: `public class FooService : IFooService`; interface in `Interfaces/IFooService.cs`. XML `/// <summary>` docs on public members are welcome when they earn their keep (well-written, not boilerplate)
