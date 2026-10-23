import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, ArrowLeft, Shield } from 'lucide-react';
import Button from '../components/common/Button.jsx';
import Card from '../components/common/Card.jsx';

export function PlaceholderPage({ title, phase, description }) {
  const navigate = useNavigate();
  const location = useLocation();

  const routeName = location.pathname.replace('/', '').replace(/-/g, ' ');

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Card className="text-center py-12 px-6">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-5 shadow-xs">
          <Clock className="w-8 h-8" />
        </div>

        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-3">
          {phase || 'Coming in a later phase'}
        </span>

        <h2 className="text-2xl font-bold text-slate-900 capitalize mb-2">
          {title || routeName}
        </h2>

        <p className="text-sm text-slate-600 max-w-md mx-auto mb-8 leading-relaxed">
          {description ||
            `This module is part of the implementation roadmap and will be activated in an upcoming development phase according to MASTER_PROMPT.md.`}
        </p>

        <div className="bg-slate-50 rounded-xl p-4 mb-8 text-left border border-slate-200 text-xs space-y-2">
          <div className="flex items-center space-x-2 text-slate-700 font-medium">
            <Shield className="w-4 h-4 text-teal-600" />
            <span>Planned Scope:</span>
          </div>
          <p className="text-slate-500 pl-6">
            Endpoint integration, interactive maps, live WebSockets, and payment/reporting workflows will connect directly to this route.
          </p>
        </div>

        <div className="flex justify-center space-x-3">
          <Button variant="outline" icon={ArrowLeft} onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default PlaceholderPage;
