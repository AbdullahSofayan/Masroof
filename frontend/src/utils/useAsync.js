import { useEffect, useState } from 'react';
export function useAsync(load, dependencies = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    Promise.resolve().then(load).then((data) => { if (active) setState({ data, loading: false, error: '' }); })
      .catch((error) => { if (active) setState({ data: null, loading: false, error: error.message || 'Something went wrong. Please try again.' }); });
    return () => { active = false; };
  }, [...dependencies, version]);
  return { ...state, reload: () => setVersion((value) => value + 1) };
}
