import { onCall, HttpsError } from 'firebase-functions/v2/https';

interface TimeEntryInput {
  date: string;
  description?: string;
  durationHours: number;
  projectName: string;
  status: string;
  invoiceId?: string;
}

interface StatusReportSection {
  projectName: string;
  activities: string[];
  outcomes: string[];
}

interface GenerateStatusReportRequest {
  customerName: string;
  entries: TimeEntryInput[];
}

interface GenerateStatusReportResponse {
  sections: StatusReportSection[];
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}

export const generateStatusReport = onCall<GenerateStatusReportRequest>(
  { cors: true },
  async (request): Promise<GenerateStatusReportResponse> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Anthropic API key not configured');
    }

    const { customerName, entries } = request.data;

    if (!entries || entries.length === 0) {
      throw new HttpsError('invalid-argument', 'No time entries provided');
    }

    // Group entries by project name
    const projectMap = new Map<string, TimeEntryInput[]>();
    for (const entry of entries) {
      const key = entry.projectName;
      if (!projectMap.has(key)) projectMap.set(key, []);
      projectMap.get(key)!.push(entry);
    }

    // Build structured prompt text
    let entriesText = '';
    for (const [projectName, projectEntries] of projectMap) {
      entriesText += `\nProject: ${projectName}\n`;
      for (const entry of projectEntries) {
        const [y, m, d] = entry.date.split('-');
        const fmtDate = `${m}/${d}/${y}`;
        const desc = entry.description || 'Work performed';
        const hrs = entry.durationHours;
        entriesText += `  - ${fmtDate} — ${desc} (${hrs}h)\n`;
      }
    }

    const prompt = `You are writing a professional client status report for a fractional technology advisory firm.

Client: ${customerName}

Time entries for this reporting period:${entriesText}
For each project listed above, generate:
1. 3-5 activity bullets describing what was done (past tense, professional, start each with a past-tense verb)
2. 2-3 outcome bullets — prefix each with "Actual:" for outcomes already achieved, or "Potential:" for future outcomes enabled by this work

Return ONLY valid JSON in this exact format, with no markdown fences or extra text:
{
  "sections": [
    {
      "projectName": "Project Name",
      "activities": ["Reviewed and updated...", "Coordinated with..."],
      "outcomes": ["Actual: Reduced...", "Potential: Enables..."]
    }
  ]
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new HttpsError('internal', `Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = data.content[0]?.text || '';

    let parsed: GenerateStatusReportResponse;
    try {
      // Strip any markdown code fences Claude may have added
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found in response');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      throw new HttpsError('internal', `Failed to parse AI response: ${text.slice(0, 500)}`);
    }

    if (!parsed.sections || !Array.isArray(parsed.sections)) {
      throw new HttpsError('internal', 'AI response missing sections array');
    }

    return parsed;
  }
);
