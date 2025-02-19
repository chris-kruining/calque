import { describe, expect } from 'vitest';
import { render } from "@solidjs/testing-library"
import { Table } from './table';
import { createDataSet } from '~/features/dataset';
import { createSignal } from 'solid-js';
import { it } from '~/test-helpers';

describe('`<Table />`', () => {
    it('should render', async () => {
        const result = render(() => {
            const [data] = createSignal([]);
            const dataset = createDataSet(data);

            return <Table rows={dataset} columns={[]} />;
        });

        expect(true).toBe(true);
    });

    it('should render with groups', async () => {
        const result = render(() => {
            const [data] = createSignal([
                { id: '1', name: 'a first name', amount: 30, group: 'a' },
                { id: '2', name: 'a second name', amount: 20, group: 'a' },
                { id: '3', name: 'a third name', amount: 10, group: 'a' },
                { id: '4', name: 'a first name', amount: 30, group: 'b' },
                { id: '5', name: 'a second name', amount: 20, group: 'b' },
                { id: '6', name: 'a third name', amount: 10, group: 'b' },
            ]);
            const dataset = createDataSet(data, {
                group: { by: 'group' }
            });

            return <Table rows={dataset} columns={[
                { id: 'id', label: 'id' },
                { id: 'name', label: 'name' },
                { id: 'amount', label: 'amount' },
                { id: 'group', label: 'group' },
            ]} />;
        });

        expect(true).toBe(true);
    });
});