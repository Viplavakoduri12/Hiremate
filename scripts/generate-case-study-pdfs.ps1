# Generates static case-study PDFs served from public/case-studies.
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectRoot "public\case-studies"
$templateDirectory = Join-Path $PSScriptRoot "templates"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

function Get-HeadlessBrowserPath {
  $candidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "Chrome or Edge was not found for PDF generation."
}

function Convert-ToFileUrl([string]$Path) {
  return [System.Uri]::new($Path).AbsoluteUri
}

function Escape-PdfText([string]$Text) {
  $Text = $Text.Replace("\", "\\")
  $Text = $Text.Replace("(", "\(")
  $Text = $Text.Replace(")", "\)")
  return $Text
}

function Write-SimplePdf {
  param(
    [string]$Path,
    [string]$Title,
    [string[]]$Lines
  )

  $commands = New-Object System.Collections.Generic.List[string]
  $commands.Add("BT")
  $commands.Add("/F2 22 Tf")
  $commands.Add("1 0 0 1 48 794 Tm")
  $commands.Add("(" + (Escape-PdfText $Title) + ") Tj")
  $commands.Add("/F1 11 Tf")

  $headingSet = @(
    "Overview",
    "Automation Coverage",
    "Negative Testing",
    "Assertions",
    "Bug Watch"
  )

  $y = 765

  foreach ($line in $Lines) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      $y -= 10
      continue
    }

    if ($headingSet -contains $line) {
      $commands.Add("/F2 13 Tf")
      $commands.Add("1 0 0 1 48 $y Tm")
      $commands.Add("(" + (Escape-PdfText $line) + ") Tj")
      $commands.Add("/F1 11 Tf")
      $y -= 18
      continue
    }

    $commands.Add("1 0 0 1 54 $y Tm")
    $commands.Add("(" + (Escape-PdfText $line) + ") Tj")
    $y -= 14
  }

  $commands.Add("/F1 9 Tf")
  $commands.Add("1 0 0 1 48 36 Tm")
  $commands.Add("(Generated for the HireMate web case-study section.) Tj")
  $commands.Add("ET")

  $content = ($commands -join "`n") + "`n"
  $encoding = [System.Text.Encoding]::ASCII
  $contentLength = $encoding.GetByteCount($content)

  $objects = @(
    "1 0 obj`n<< /Type /Catalog /Pages 2 0 R >>`nendobj`n",
    "2 0 obj`n<< /Type /Pages /Kids [3 0 R] /Count 1 >>`nendobj`n",
    "3 0 obj`n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`nendobj`n",
    "4 0 obj`n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`nendobj`n",
    "5 0 obj`n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`nendobj`n",
    "6 0 obj`n<< /Length $contentLength >>`nstream`n$content" + "endstream`nendobj`n"
  )

  $builder = New-Object System.Text.StringBuilder
  [void]$builder.Append("%PDF-1.4`n")

  $offsets = New-Object System.Collections.Generic.List[int]

  foreach ($object in $objects) {
    $offsets.Add($encoding.GetByteCount($builder.ToString()))
    [void]$builder.Append($object)
  }

  $xrefOffset = $encoding.GetByteCount($builder.ToString())
  [void]$builder.Append("xref`n")
  [void]$builder.Append("0 7`n")
  [void]$builder.Append("0000000000 65535 f `n")

  foreach ($offset in $offsets) {
    [void]$builder.Append(("{0:D10} 00000 n `n" -f $offset))
  }

  [void]$builder.Append("trailer`n")
  [void]$builder.Append("<< /Size 7 /Root 1 0 R >>`n")
  [void]$builder.Append("startxref`n")
  [void]$builder.Append("$xrefOffset`n")
  [void]$builder.Append("%%EOF")

  [System.IO.File]::WriteAllText($Path, $builder.ToString(), [System.Text.ASCIIEncoding]::new())
}

$documents = @(
  @{
    FileName = "hiremate-authentication-testing.pdf"
    Title = "HireMate Case Study 01 - Authentication Testing"
    Lines = @(
      "Overview",
      "Scenario: HireMate must authenticate applicants, HR users, and admins",
      "with the correct role-based entry path and dashboard redirect.",
      "",
      "Automation Coverage",
      "- Open the signup or login flow and choose the user role.",
      "- Enter valid name, email, password, and verification data.",
      "- Submit the form and confirm successful access to the dashboard.",
      "",
      "Negative Testing",
      "- Invalid email format must show a clear validation message.",
      "- Weak password or wrong OTP must block form submission.",
      "- Wrong-role access must be denied for protected routes.",
      "",
      "Assertions",
      "- Success feedback is visible after valid authentication.",
      "- Error text matches the failing field or access rule.",
      "- Redirect target matches the chosen applicant, HR, or admin path.",
      "",
      "Bug Watch",
      "- Role query state can create confusing redirects if it is stale.",
      "- OTP expiry feedback should stay visible and easy to understand."
    )
  },
  @{
    FileName = "hiremate-resume-screening-testing.pdf"
    Title = "HireMate Case Study 02 - Resume Screening Testing"
    Lines = @(
      "Overview",
      "Scenario: HireMate accepts PDF resumes, extracts text, runs ATS",
      "matching, and surfaces the strongest candidates for HR review.",
      "",
      "Automation Coverage",
      "- Upload a valid PDF resume and verify preview generation.",
      "- Trigger ATS analysis with a role and job description.",
      "- Confirm the ranked candidate list and match percentage display.",
      "",
      "Negative Testing",
      "- Non-PDF files must be rejected by the upload validation.",
      "- Empty resume text should stop ATS analysis with an error message.",
      "- Failed batch analysis should fall back without crashing the UI.",
      "",
      "Assertions",
      "- Uploaded resume preview is visible before submission.",
      "- Match score and missing-skills output render after analysis.",
      "- Higher scoring candidates appear above lower scoring candidates.",
      "",
      "Bug Watch",
      "- Resume parsing can fail on image-only PDFs without extracted text.",
      "- ATS summaries should stay consistent between batch and fallback runs."
    )
  },
  @{
    FileName = "hiremate-application-tracking-testing.pdf"
    ReportHtmlPath = Join-Path $templateDirectory "hiremate-application-tracking-report.html"
  }
)

$browserPath = $null

foreach ($document in $documents) {
  $destinationPath = Join-Path $outputDirectory $document.FileName

  if ($document.ContainsKey("ReportHtmlPath")) {
    if (-not $browserPath) {
      $browserPath = Get-HeadlessBrowserPath
    }

    $reportUrl = Convert-ToFileUrl $document.ReportHtmlPath

    & $browserPath `
      --headless=new `
      --disable-gpu `
      --disable-crash-reporter `
      --no-first-run `
      --allow-file-access-from-files `
      --print-to-pdf="$destinationPath" `
      --no-pdf-header-footer `
      $reportUrl

    if (-not (Test-Path $destinationPath) -or (Get-Item $destinationPath).Length -le 0) {
      throw "Failed to generate PDF for $($document.FileName)"
    }

    continue
  }

  Write-SimplePdf `
    -Path $destinationPath `
    -Title $document.Title `
    -Lines $document.Lines
}

Write-Output "Generated 3 HireMate case-study PDFs in $outputDirectory"
