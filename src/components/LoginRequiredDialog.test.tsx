// NOTE: jest-dom adds handy assertions to Jest and it is recommended, but not required.
import {render, fireEvent} from '@solidjs/testing-library';

import LoginRequiredDialog from './LoginRequiredDialog';

test('shows the children when the checkbox is checked', () => {
	const testMessage = 'Test Message';

	const {queryByText, getByLabelText, getByText} = render(
		() => <LoginRequiredDialog/>,
	);

	// query* functions will return the element or null if it cannot be found.
	// get* functions will return the element or throw an error if it cannot be found.
	expect(queryByText(testMessage)).toBeNull();
});
