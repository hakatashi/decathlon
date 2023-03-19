export default class PageNotFoundError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = 'PageNotFoundError';
	}
}
