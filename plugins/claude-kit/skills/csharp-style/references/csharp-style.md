# C# Style

Examples use a generic library, `Acme.Documents`. Substitute the project's own namespaces and type names rather than copying the example names. Inside a repo already in this style, follow a sibling file's layout exactly.

## 1. File Structure

Order usings `System.*` first, then third-party where convenient (Serilog often mid-list), then project namespaces, then other third-party such as `AutoMapper` and `MediatR`. The order is not strictly alphabetical. Put no blank lines between groups, and one blank line before the namespace.

Keep namespaces coarse. Plugin assemblies declare none. A warranted namespace aligns to a plugin or large functional chunk, typically one root per project. Folders never generate sub-namespaces such as `Acme.Documents.Services`.

Where a new file declares a namespace, make it file-scoped:
```csharp
namespace Acme.Documents;
```

Leave existing block-scoped files, such as `Assembly/RegisterServices.cs`, alone.

Write no file header: no copyright, author block or license. Files begin with `using`.

Interfaces live in `Interfaces/`, never beside their implementations.

Example:
```csharp
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using Serilog;
using Acme.Domain;
using Acme.Common.Platform;
using AutoMapper;
using System.Threading;

namespace Acme.Documents;

public class FormService : IFormService
```

## 2. Region Order

Organize a class into `#region` blocks in this order:

1. `#region Constants` - `private const string` declarations, omitted if none
2. `#region Variables` - private fields under `// Group.` labels
3. `#region Constructor` - the single constructor
4. Public method-group regions named for what they do, such as `#region Form Processing`
5. `#region Private Methods` - last, optionally with nested regions for sub-themes

Close every region with a matching `#endregion`. Align both lines with the region's contents, not the class brace.

Skeleton:
```csharp
public class FormService : IFormService
{
    #region Constants
    private const string downloadUrlSuffix = ".download_url";
    private const string signatureUrlSuffix = ".signature_url";
    #endregion

    #region Variables
    // Values.
    private static StringComparison IgnoreCase => StringComparison.InvariantCultureIgnoreCase;

    // Mapper.
    private readonly Mapper _mapperService;

    // Services.
    private readonly IApiService _apiService;
    private readonly IHtmlService _htmlService;
    #endregion

    #region Constructor
    public FormService(
            IApiService apiService,
            IHtmlService htmlService
    )
    {
        // Save Services.
        _apiService = apiService;
        _htmlService = htmlService;
    }
    #endregion

    #region Form Processing
    public async Task<FilledForm?> ProcessFormAsync(
        FilledDocument document,
        CancellationToken cancellationToken
    )
    {
        // ...
    }
    #endregion

    #region Private Methods

        #region Form Handling
        private async Task<FilledForm?> CreateFilledFormAsync(...) { ... }
        #endregion

        #region Field Handling
        private Task<Dictionary<string, string>> ExtractFieldsAsync(...) { ... }
        #endregion

    #endregion
}
```

## 3. Field Naming and Grouping

- Private fields are `_camelCase`, and injected dependencies are `readonly`.
- `private const` names are `camelCase` for local strings (`downloadUrlSuffix`) and `SCREAMING_SNAKE_CASE` for cross-cutting markers (`EMAIL_SENT`).
- Static computed comparison properties are PascalCase: `IgnoreCase`.

In `#region Variables`, group fields under single-line `// Group.` labels, a blank line between groups. Common labels: `// Values.` for static comparers and computed defaults, `// Mapper.` for AutoMapper, `// Services.` for injected services, `// Settings.` for `IOptionsMonitor<T>`, and `// State.` for rare mutable state.

## 4. Constructor

Write one primary constructor, with no overloads or static factories. With two or more parameters, put each on its own line, indented eight spaces from the class brace. The closing `)` sits on its own line, indented four spaces at the signature's level. The body opens with a section comment naming what gets assigned. `ArgumentNullException` guards on injected dependencies are optional. Construct AutoMapper inline under `// Save Mapper.`.

Example:
```csharp
public FormService(
        IApiService apiService,
        IHtmlService htmlService
)
{
    // Save Services.
    _apiService = apiService;
    _htmlService = htmlService;

    // Save Mapper.
    var mapConfig = new MapperConfiguration(c =>
    {
        c.CreateMap<Form, FilledForm>();
        c.CreateMap<FormField, FilledFormField>();
    });
    _mapperService = new Mapper(mapConfig);
}
```

## 5. Method Declarations

Async method names end in `Async`. `CancellationToken` is the last parameter. A multi-parameter method puts each parameter on its own line at a four-space indent, with the closing `)` on its own line at the signature's indent. Add no method-level attributes except where required, such as a MediatR handler signature.

## 6. Method Body Sections

This is the heart of the style. A method body is a sequence of sections, each under a `// Title.` comment naming what the next block does, not what it did or why.

- Comments are Title Case and end with a period: `// Validate Parameters.`
- Prefer one blank line before each section comment.
- A comment is a short, imperative statement of the next block's intent, a reading aid for someone scanning. The test is intent, not vocabulary: `// Abort if we don't have a Valid VIN, make no changes.` is in-voice. Avoid "Now we...", "Here we..." and "This will...".
- A comment never explains history, decisions, alternatives weighed or issues met. A WHY comment is rare.

Common section comments: `// Validate Parameters.` for guard clauses, `// Return Value.` for the return variable, `// Declare Variables.` for locals used across try blocks, `// Get X.` / `// Extract X.` / `// Build X.` / `// Apply X.` for major operations, and `// Return the Processed Result.` at the bottom.

Body conventions:
- Return early on null or invalid input: `if (document is null) return default;`
- Return `default`, not `null`, on nullable types.
- `is null` / `is not null` over `== null` / `!= null`.
- `??=` for default assignment: `filledDocument ??= new();`
- `var` when the right-hand side makes the type obvious.
- LINQ method chains, not query syntax.
- Collection expressions and spreads: `[.. source.Where(...)]` over `.ToArray()`, `[item]` over `new[] { item }`, `[.. existing, item]` over `Append`/`Concat` + `ToArray`.
- Named-type object initializers keep explicit parens: `new FilledForm() { Title = docType }`, not `new FilledForm { Title = docType }`. Target-typed `new()` stays preferred where the type is inferable.
- String interpolation `$"..."` over `string.Format` or concatenation.

Example:
```csharp
public async Task<FilledForm?> ProcessFormAsync(
    FilledDocument document,
    CancellationToken cancellationToken
)
{
    // Validate Parameters.
    if (document is null) return default;

    // Return Value.
    FilledForm? form = default;

    try
    {
        // Extract Document Fields from Document.
        var values = await ExtractFieldsAsync(document, cancellationToken);

        // Document Form is only known by "FormCode", Validate.
        _ = values.TryGetValue("FormCode", out var formCode);
        if (formCode.IsNullOrWhiteSpace()) return default;

        // Get Processed Form with Fields.
        form = await CreateFilledFormAsync(formCode, values, cancellationToken);
        form ??= new();

        // Get Document Type.
        var docType = document.DocumentTypes?.FirstOrDefault() ?? "Document";

        // Set Form Properties.
        form.Submitted = document.UploadFinishedAt;
        form.UserId = document.ScannedByUsername;
        form.Title = header.IsNotNullOrWhiteSpace() ? header : docType;

        // Update HTML with Changes.
        await UpdateFormHtmlAsync(form, cancellationToken);

        // Apply the Form to the Document.
        document.FilledForm = form;
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Failure Processing Document.");
    }

    // Return the Processed Form.
    return form;
}
```

The comments alone should tell the story of the method.

## 7. Async Patterns

Pass cancellation tokens down the call chain. A synchronous helper keeps its `Task<T>` signature for interface uniformity and returns `Task.FromResult(...)`, or `Task.CompletedTask` for `Task`. Use `ConfigureAwait(false)` in background services (`Services/Background/*`), not regular services, matching the surrounding file. Return `Task` or `Task<T>`, never `ValueTask`.

## 8. Logging

Log through injected `ILogger<T>`, preferred for new code, or Serilog's static `Log`, matching the surrounding file. Add `using Serilog;` when the static `Log` is used. Catch blocks log in this shape:
```csharp
catch (Exception ex)
{
    Log.Error(ex, "Failure Processing Document.");
}
```
Output services trace with method-name-prefixed `Log.Debug($"...")`: `Log.Debug($"Acme.Documents.PdfService.CreateFromHtmlAsync called with Html: {html}");`. Log messages end in a period.

## 9. Exception Handling

The dominant shape is `try { ... } catch (Exception ex) { Log.Error(...); }`, where the catch logs and the method returns `default`. Background services add a `finally` for delay or sleep loops. Use `throw;` only when the exception must propagate, and never `throw ex;`. Define no custom exception types. Use the generic `Exception`.

## 10. Null Handling

Enable nullable reference types (`<Nullable>enable</Nullable>` in the csproj). Annotate nullable returns and parameters: `Task<FilledForm?>`, `Stream?`. Discard an unused return: `_ = values.TryGetValue("Key", out var value);`. Use `??` chains for fallbacks. Never use the null-forgiving operator `!`. Use null-conditional and null-coalescing instead.

## 11. DI Registration

`Assembly/RegisterServices.cs` is the library's Autofac module, and every type registers the same way:

```csharp
builder.RegisterType<DocumentService>()
       .AsImplementedInterfaces()
       .PreserveExistingDefaults();
```

`.AsImplementedInterfaces()` infers interfaces from the implementation. `.PreserveExistingDefaults()` respects any prior registration.

Group registrations by domain under uppercase label comments, each ending with a period like every other label comment:

```csharp
// HANDLERS.
builder.RegisterType<AzureFileSaveHandler>()
       .AsImplementedInterfaces()
       .PreserveExistingDefaults();

// BACKGROUND.
builder.RegisterType<DocumentProcessingService>()
       .AsImplementedInterfaces()
       .PreserveExistingDefaults();

// SERVICES.
builder.RegisterType<DocumentOutputService>()
       .AsImplementedInterfaces()
       .PreserveExistingDefaults();
```

For settings, inject `IOptionsMonitor<TSettings>`, not `IOptions<T>`, and read `.CurrentValue` at use time.

## 12. Naming Conventions

| Suffix | Used for | Example |
| --- | --- | --- |
| `Service` | Core operations and orchestration | `DocumentService`, `FormService`, `PdfService` |
| `Handler` | MediatR notification handlers | `AzureFileSaveHandler`, `NetworkFileSaveHandler` |
| `Helper` | Static utility methods | `DocumentHelper`, `FieldHelper`, `FormHelper` |
| `Notification` | MediatR notifications | `DocumentProcessedNotification`, `FileSaveNotification` |
| `Repository` (Legacy only) | Older data-access objects | `DocumentBatchRepository` |

Method verb prefixes: `Get*` reads or fetches, `Process*` orchestrates a pipeline, `Create*` builds a new value, `Extract*` pulls data from a structure, `Build*` constructs a complex output, and `Save*` or `Set*` writes or assigns.

Interfaces take an `I` prefix matching the implementation: `IDocumentService` for `DocumentService`.

## 13. MediatR Notifications

Notifications are simple data holders:

```csharp
public class FileSaveNotification : INotification
{
    public string Caller { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public byte[] Data { get; set; } = Array.Empty<byte>();
    public CancellationToken CancellationToken { get; set; }
}
```

Handlers implement `INotificationHandler<T>` and live in `Handlers/`.

Publish with the notification built inline, setting `Caller = nameof(...)` so handlers know who fired it:
```csharp
await _mediator.Publish(
    new MessageProcessedNotification
    {
        Caller = nameof(FormService),
        Message = message,
        FilledForm = filledForm,
        CancellationToken = cancellationToken
    }
);
```

## 14. Models and Settings

Models live under `Models/` by purpose: `Models/Database/` for DB-shaped data, `Models/Documents/` for domain documents and forms, `Models/Email/` for email shapes, and `Models/Settings/` for `IOptionsMonitor<T>` settings classes.

Settings classes are plain DTOs with `{ get; set; }` auto-properties, never records. Property init values use collection expressions where natural:
```csharp
public List<byte[]> Images { get; set; } = [];
public List<Tuple<string, string>> Tokens { get; set; } = [];
public string FormCode { get; set; } = string.Empty;
public FilledForm FilledForm { get; set; } = new();
```

## 15. Whitespace

Indent four spaces, never tabs. Put one blank line between methods in a region, and between regions.

## 16. New Service Template

For a brand-new service in `Services/Build/` or `Services/Process/`, use this skeleton:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using Serilog;
using Acme.Domain;

namespace Acme.Documents;

public class WidgetService : IWidgetService
{
    #region Variables
    // Services.
    private readonly IApiService _apiService;
    #endregion

    #region Constructor
    public WidgetService(
            IApiService apiService
    )
    {
        // Save Services.
        _apiService = apiService;
    }
    #endregion

    #region Widget Processing
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
            widget = await _apiService.GetWidgetAsync(request.Id, cancellationToken);

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
    #endregion

    #region Private Methods
    // (private helpers here, in nested regions if multiple themes)
    #endregion
}
```

Register it in `Assembly/RegisterServices.cs` under the appropriate label, such as `// SERVICES.`:

```csharp
builder.RegisterType<WidgetService>()
       .AsImplementedInterfaces()
       .PreserveExistingDefaults();
```

Declare its interface in `Interfaces/IWidgetService.cs`.
