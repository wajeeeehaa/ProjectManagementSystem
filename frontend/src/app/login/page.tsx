'use client';

import { useEffect, useState } from 'react';
import { consumeSessionExpiredMessage } from '../../lib/session';

export default function LoginPage() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setNotice(consumeSessionExpiredMessage());
  }, []);

  return (
    <main>
      <h1>Login</h1>
      {notice ? <p>{notice}</p> : null}
    </main>
  );
}
