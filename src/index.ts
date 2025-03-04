import {
	Action,
	expose,
	Icon,
	IconEnum,
	List,
	Form,
	kv,
	open,
	fetch,
	toast,
	ui,
	TemplateUiCommand
} from "@kksh/api/ui/template"

import {
	generalActions, 
	friendsActions, 
	userActions, 
	specialActions
} from "./actions"

const LETTERBOXD_URL = "https://letterboxd.com"
const LETTERBOXD_TMDB_URL = `${LETTERBOXD_URL}/tmdb`
const USERNAME_KEY = 'letterboxdUser'

function convertActions(actions: any) {
	return actions.map((action: any) => {
		return new Action.Action({
			title: action.title,
			value: action.value,
			icon: new Icon({
				type: IconEnum.Iconify,
				value: action.icon
			})
		})
	})
}

function actionsContainsValue(actions: any, value: string) {
	return actions.some((action: any) => action.value === value)
}

async function getFinalURL(initialURL: string) {
    try {
        const response = await fetch(initialURL, {
            method: 'HEAD' // Use HEAD to avoid downloading the entire content
        });
        return response.url; // The final URL after redirection
    } catch (error) {
		return ''
    }
}

class LetterboxdCmd extends TemplateUiCommand {
	highlightedMovieId: string = ""

	async onFormSubmit(value: Record<string, any>): Promise<void> {
		if (value.username) {
			await kv.set(USERNAME_KEY, value['clear-username'] ? '' : value.username)
			toast.success(`Letterboxd username set to ${value.username}.`)
		}
		if (value['clear-username']) {
			await kv.delete(USERNAME_KEY)
			toast.success(`Letterboxd username removed.`)
		}
		ui.goBack()
	}

	async load() {
		await ui.setSearchBarPlaceholder("Search for a movie...");
		await ui.render(
			new List.List({
				filter: 'none',
				items: [
				new List.Item({
					title: 'Search for a movie',
					subTitle: 'Type the name of the movie you want to search for in the search bar above',
					icon: new Icon({
						type: IconEnum.Iconify,
						value: 'mdi:movie-search'
					}),
					value: 'search',
					defaultAction: 'Search',
					actions: new Action.ActionPanel({
						items: convertActions(specialActions)
					})
				})
			]})
		);
	}

	async onSearchTermChange(term: string): Promise<void> {
		this.searchTerm = term;
		return Promise.resolve()
	}

	async onEnterPressedOnSearchBar(): Promise<void> {
		if (!this.searchTerm) {
			return
		}
		const url = `https://tmdb-kunkun.jackyklai.workers.dev/?search=${encodeURIComponent(this.searchTerm)}`;
		const searchData = await (await fetch(url)).json();
		let actions = convertActions(generalActions)
		if (await kv.get(USERNAME_KEY)) {
			actions = actions.concat(convertActions(friendsActions))
			actions = actions.concat(convertActions(userActions))
		}
		actions = actions.concat(convertActions(specialActions))
		ui.render(new List.List({}))
		ui.render(
			new List.List({
				filter: 'none',
				items: searchData.results.map((movie: any) => {
					let movieTitle: string = movie.title
					if (movie.release_date && movie.release_date.includes('-')) {
						movieTitle += ` (${movie.release_date.split('-')[0]})`
					}
					return new List.Item({
						title: movieTitle,
						subTitle: movie.overview.substring(0, 100 - movie.title.length) + "...",
						icon: movie.poster_path ? new Icon({
							type: IconEnum.RemoteUrl,
							value: `https://image.tmdb.org/t/p/w500${movie.poster_path}`
						}) : new Icon({
							type: IconEnum.Iconify,
							value: "mdi:movie"
						}),
						value: JSON.stringify(movie),
						defaultAction: 'Open on Letterboxd',
						actions: new Action.ActionPanel({
							items: actions
						})
					})
				})
			})
		)
		ui.setSearchTerm('')
		return Promise.resolve()
	}

	onHighlightedListItemChanged(value: string): Promise<void> {
		this.highlightedMovieId = value == 'search' ? '' : JSON.parse(value).id
		return Promise.resolve()
	}

	async onActionSelected(value: string): Promise<void> {
		let letterboxdUsername = await kv.get(USERNAME_KEY)
		if (actionsContainsValue(generalActions, value)) {
			getFinalURL(`${LETTERBOXD_TMDB_URL}/${this.highlightedMovieId}`)
			.then((url) => {
				open.url(`${url}/${value}`)
			})
		} else if (actionsContainsValue(friendsActions, value)) {
			getFinalURL(`${LETTERBOXD_TMDB_URL}/${this.highlightedMovieId}`)
			.then((url) => {
				const base_url = url.split('/film/')[0]
				const movie_uri = url.split('/film/')[1]
				open.url(`${base_url}/${letterboxdUsername}/friends/film/${movie_uri}/${value}`)
			})
		} else if (actionsContainsValue(userActions, value)) {
			getFinalURL(`${LETTERBOXD_TMDB_URL}/${this.highlightedMovieId}`)
			.then((url) => {
				const base_url = url.split('/film/')[0]
				const movie_uri = url.split('/film/')[1]
				open.url(`${base_url}/${letterboxdUsername}/film/${movie_uri}/${value}`)
			})
		} else {
			if (value === 'settings') {
				let formFields: any = [
					new Form.InputField({
						key: 'username',
						label: 'Letterboxd Username',
						description: 'Providing your Letterboxd username will enable additional actions like viewing your friends\' reviews and lists.',
						optional: true,
						placeholder: await kv.get(USERNAME_KEY) ?? 'Enter your Letterboxd username'
					})
				]
				if (letterboxdUsername) {
					formFields.push(
						new Form.BooleanField({
							key: 'clear-username',
							label: 'Clear Letterboxd Username',
							description: 'Check this box to unset the Letterboxd username',
							optional: true,
							component: 'checkbox',
							default: false
						})
					)
				}
				return ui.render(
					new Form.Form({
						key: 'settings',
						fields: formFields
					})
				)
			}
		}
	}

	onListItemSelected(value: string): Promise<void> {
		if (value !== 'search' && this.searchTerm === '') {
			this.highlightedMovieId = JSON.parse(value).id
			open.url(`${LETTERBOXD_TMDB_URL}/${this.highlightedMovieId}`)
		}
		return Promise.resolve()
	}
}

expose(new LetterboxdCmd())
