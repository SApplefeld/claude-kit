# The doctor's auto-compaction-window writer: sets autoCompactWindow in a
# user settings.json while proving every other setting survived the rewrite.
#
# Dot-sourced by doctor.ps1, which calls Set-AutoCompactWindow under its
# "Auto-compaction window" check; the repo test suite dot-sources the same
# file and runs the same function against a sandbox settings path, which is
# why the path arrives as a parameter and is never resolved from the
# environment here. There is no default: the real settings.json carries the
# permissions block, an env block, and possibly apiKeyHelper, so a forgotten
# redirect must be a loud parameter error rather than a rewrite of the
# operator's live settings. This file defines functions only; dot-sourcing it
# runs nothing and writes nothing.

# Set autoCompactWindow at $Path, preserving everything else. Returns
# @{ ok = $true } on a verified swap, or @{ ok = $false; reason = ... } with
# nothing changed. The reason string can carry content derived from the file
# (key names, exception text); the caller sanitizes it before it reaches a
# report.
#
# The write is verified before it lands rather than trusted: the original is
# backed up byte-for-byte, the new content is written to a temp file and read
# back, and the swap happens only when every original top-level key survived
# with an identical serialized value and the file on disk still holds the
# exact bytes the rewrite started from.
function Set-AutoCompactWindow {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][int]$Value
    )
    # A single fixed backup name, so repeated runs cannot accumulate
    # timestamped plaintext copies of a file that can carry an env block and
    # apiKeyHelper; a verified swap removes it again below, so only a failed
    # run leaves one behind.
    $backup = "$Path.bak-precompact"
    $temp = "$Path.tmp-precompact-$PID"
    $backupWritten = $false
    try {
        # One byte snapshot anchors everything: the JSON is decoded from these
        # bytes rather than from a second read that could see a different
        # file, and the pre-swap abort check compares the disk against these
        # same bytes. The decode is explicit UTF-8 because Windows PowerShell
        # 5.1's Get-Content -Raw decodes a UTF-8 file with the ANSI codepage,
        # silently mangling every non-ASCII character (an accented username in
        # a path, an env value), and the mangled string would then round-trip
        # into the rewrite and ship as the "fixed" file.
        $rawBytes = [System.IO.File]::ReadAllBytes($Path)
        $textBytes = $rawBytes
        if ($rawBytes.Length -ge 3 -and $rawBytes[0] -eq 0xEF -and $rawBytes[1] -eq 0xBB -and $rawBytes[2] -eq 0xBF) {
            $textBytes = $rawBytes[3..($rawBytes.Length - 1)]
        }
        $raw = (New-Object System.Text.UTF8Encoding($false)).GetString($textBytes)
        $original = $raw | ConvertFrom-Json
        $originalKeys = @($original.PSObject.Properties.Name)

        # The backup is a byte-for-byte copy of the file itself, never a
        # decode-and-re-encode, so it can restore the original exactly.
        Copy-Item -LiteralPath $Path -Destination $backup -Force
        $backupWritten = $true

        if ($originalKeys -contains "autoCompactWindow") {
            $original.autoCompactWindow = $Value
        }
        else {
            $original | Add-Member -NotePropertyName "autoCompactWindow" -NotePropertyValue $Value
        }

        # ConvertTo-Json defaults to -Depth 2, which would silently flatten
        # nested settings into strings, hence the explicit depth.
        [System.IO.File]::WriteAllText($temp, (ConvertTo-Json -InputObject $original -Depth 100), (New-Object System.Text.UTF8Encoding($false)))

        # Read the candidate back and verify it before swapping it in: every
        # original top-level key must still be present with an identical
        # serialized value (autoCompactWindow excepted, being the one
        # deliberate change), and the new value must be there. That is what
        # this proves, no more: top-level survival of every setting through
        # the rewrite. It cannot prove anything about a value the serializer
        # reproduces identically wrong on both sides. -InputObject rather
        # than a pipe, which would unwrap arrays and drop nulls before the
        # serializer saw them; a null serializes to an empty string on both
        # sides, which still compares correctly against any non-null.
        $verify = [System.IO.File]::ReadAllText($temp, (New-Object System.Text.UTF8Encoding($false))) | ConvertFrom-Json
        $verifyKeys = @($verify.PSObject.Properties.Name)
        $damaged = @()
        foreach ($key in $originalKeys) {
            if ($key -eq "autoCompactWindow") { continue }
            if ($verifyKeys -notcontains $key) { $damaged += $key; continue }
            $before = ConvertTo-Json -InputObject ($original.PSObject.Properties[$key].Value) -Depth 100 -Compress
            $after = ConvertTo-Json -InputObject ($verify.PSObject.Properties[$key].Value) -Depth 100 -Compress
            if ($before -ne $after) { $damaged += $key }
        }
        if ($damaged.Count -gt 0) {
            Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
            return @{ ok = $false; reason = "the rewritten file lost or changed top-level setting(s): " + ($damaged -join ", ") + "; nothing was changed (backup at $backup)" }
        }
        if ([int]$verify.autoCompactWindow -ne $Value) {
            Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
            return @{ ok = $false; reason = "the rewritten file did not carry the new window value; nothing was changed (backup at $backup)" }
        }

        # Abort on a concurrent write. The harness itself rewrites
        # settings.json when a permission is granted, and the doctor is
        # ordinarily run from inside a live session, so the window between
        # the snapshot above and the swap below is real. Anything written in
        # between is in neither the candidate nor the backup, so the swap
        # must not clobber it.
        $current = [System.IO.File]::ReadAllBytes($Path)
        if ([Convert]::ToBase64String($current) -ne [Convert]::ToBase64String($rawBytes)) {
            Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
            return @{ ok = $false; reason = "settings.json changed on disk while the rewrite was being prepared (another writer, likely the live session); nothing was changed, re-run the doctor (backup at $backup)" }
        }

        Move-Item -LiteralPath $temp -Destination $Path -Force

        # A verified swap leaves the backup nothing to restore; removing it
        # keeps plaintext settings copies from persisting.
        Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
        return @{ ok = $true }
    }
    catch {
        # A failure anywhere (an unreadable file, a locked destination at the
        # verify read or the move) must not orphan the temp file beside the
        # real one; the backup, if one was taken by then, is named so the
        # caller's report says where the original is.
        Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
        $reason = $_.Exception.Message
        if ($backupWritten) { $reason = $reason + " (backup at $backup)" }
        return @{ ok = $false; reason = $reason }
    }
}
