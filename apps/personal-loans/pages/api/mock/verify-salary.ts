import type { NextApiRequest, NextApiResponse } from 'next';

export default function verifySalary(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ message: 'Method not allowed' });
  }
  const { employerName, monthlySalary } = request.body ?? {};
  if (typeof employerName !== 'string' || !employerName.trim() ||
      typeof monthlySalary !== 'number' || !Number.isFinite(monthlySalary) || monthlySalary <= 0) {
    return response.status(400).json({ message: 'Enter an employer and a positive monthly salary' });
  }
  return response.status(200).json({
    requiresCoApplicant: monthlySalary < 25000,
    decision: monthlySalary < 25000 ? 'co-applicant-required' : 'approved',
    source: 'mock',
  });
}