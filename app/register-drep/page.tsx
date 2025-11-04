'use client';

import RegisterDRepForm from '@/components/features/RegisterDRepForm';

export default function RegisterDRepPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-display font-bold mb-8">Register as DRep</h1>
      <RegisterDRepForm />
    </div>
  );
}

