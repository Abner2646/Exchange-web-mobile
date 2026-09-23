import React, { useState } from 'react';
import { useBusinessConfig, useUpdateConfig } from '../queries';
import { Button, Field } from '../../../shared/ui';
import { BusinessConfigItem } from '../api';

const ConfigRow: React.FC<{ item: BusinessConfigItem }> = ({ item }) => {
  const updateMutation = useUpdateConfig();
  const [val, setVal] = useState(item.value);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ ...item, value: String(val) });
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }} data-testid={`config-row-${item.key}`}>
      <div style={{ flex: 1 }}>
        <strong>{item.key}</strong>
        <p style={{ margin: 0, fontSize: '0.8em', color: 'gray' }}>{item.description}</p>
      </div>
      <div>
        {item.type === 'boolean' ? (
          <select value={val} onChange={e => setVal(e.target.value)} disabled={updateMutation.isLoading} data-testid={`config-input-${item.key}`}>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        ) : (
          <Field 
            label="" 
            value={val}
            onChange={e => setVal(e.target.value)}
            disabled={updateMutation.isLoading}
            data-testid={`config-input-${item.key}`}
          />
        )}
      </div>
      <Button type="submit" disabled={updateMutation.isLoading || val === item.value}>
        {updateMutation.isLoading ? 'Saving...' : 'Save'}
      </Button>
      {updateMutation.isSuccess && <span style={{ color: 'green' }}>Saved</span>}
      {updateMutation.isError && <span style={{ color: 'red' }}>Error</span>}
    </form>
  );
};

export const BusinessConfigEditor: React.FC = () => {
  const { data, isLoading, error } = useBusinessConfig();

  if (isLoading) return <p>Loading config...</p>;
  if (error) return <p>Error loading config</p>;

  return (
    <div>
      <h2>Business Configuration</h2>
      {data?.data.map(item => (
        <ConfigRow key={item.key} item={item} />
      ))}
    </div>
  );
};
