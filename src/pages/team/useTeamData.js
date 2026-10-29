import { useCallback, useEffect, useState } from 'react';
import { teamErrorMessage } from '../../api/team';

/**
 * Loads one /api/team resource. `load` must be stable (wrap it in useCallback) — it
 * re-runs whenever it changes. Returns { data, loading, error, reload }.
 */
export default function useTeamData(load) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const reload = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setData(await load());
        } catch (err) {
            setError(teamErrorMessage(err, 'Failed to load data.'));
        } finally {
            setLoading(false);
        }
    }, [load]);

    useEffect(() => { reload(); }, [reload]);

    return { data, loading, error, reload };
}
