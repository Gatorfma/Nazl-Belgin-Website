$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$html = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'index.html')
$css = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'css/site.css')

$statements = @(
  'I search for what lies beneath the surface.'
  'I speak of the wound, not of beauty.'
  'Color is my protest; form, my act of defiance.'
  'I hold instinct, not the brush.'
  'I use paint to release the voice that gathers inside me.'
  'Art is not therapy, not decor, and never an investment.'
  'Art is an assault.'
  'It is a silent rebellion against numbness, against the aesthetic lie of capital, against sterilized taste.'
  'I paint not on the white walls of museums, but on the dark subconscious of humanity.'
  'History still writhes beneath my skin — I bring that voice to the surface with paint.'
  'I am raw because I am honest.'
  'I am flawed because I am alive.'
  'Creation is not divine imitation — it is the instinct to survive.'
  'That is why my figures scream, my eyes blaze, my body distorts.'
  'In my art, form is not evolution — it is resistance.'
  'I belong nowhere.'
  'I paint the inner eruption that has burned since the Stone Age.'
  'As I look at the walls of the past, I tear down the walls of the present.'
  'For me, art is not rebirth — it is renewed attack.'
)

$cursor = -1
foreach ($statement in $statements) {
  $next = $html.IndexOf($statement, $cursor + 1, [System.StringComparison]::Ordinal)
  if ($next -lt 0) { throw "Missing manifesto statement: $statement" }
  if ($next -le $cursor) { throw "Manifesto statement is out of order: $statement" }
  $cursor = $next
}

$beatCount = ([regex]::Matches($html, '<p class="manifesto__beat(?:\s|"|--)')).Count
if ($beatCount -ne 10) { throw "Expected 10 manifesto beats; found $beatCount." }

if ($html -notmatch 'class="rule rule--manifesto"') { throw 'The blue manifesto wave must remain.' }
if ($html -match 'class="mf(?:\s|--|\")') { throw 'Mock manifesto classes are still present.' }
if ($css -notmatch '\.manifesto__beat--lead') { throw 'Lead manifesto typography is missing.' }
if ($css -notmatch '\.manifesto__beat--close') { throw 'Closing manifesto typography is missing.' }
if ($css -notmatch '@media \(max-width: 720px\)[\s\S]*?\.manifesto__beat--right') { throw 'Mobile manifesto alignment is missing.' }

Write-Output 'Manifesto content and layout checks passed.'
