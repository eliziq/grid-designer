class ConfirmDialog {
	constructor(message, onConfirm) {
		this.dialog = this._create(message, onConfirm);
		this.onConfirm = onConfirm;
	}

	_create(message, onConfirm) {
		//dialog element must exist in the html
		const dialog = document.querySelector("dialog#confirm-dialog");
		dialog.innerHTML = `
            <div class="dialog-wrap">
                <div class="dialog-title"><h3>Confirm action</h3></div>
                <div class="dialog-content">
                    <p>${message}</p>
                </div>
                <div class="btns-footer">
                    <button class="btn-ro std-2" onclick="this.closest('dialog').close()">Cancel</button>
                    <button class="btn-ro std" id="confirm-btn">Confirm</button>
                </div>
            </div>`;

		dialog.querySelector("#confirm-btn").onclick = async () => {
			await this.confirmDelete();
			dialog.close();
		};
		return dialog;
	}

	async confirmDelete() {
		this.toggleLoader(true);
		await this.onConfirm();
		this.toggleLoader(false);
	}

	toggleLoader(isLoading) {
		const btn = this.dialog.querySelector("#confirm-btn");
		if (isLoading) {
			btn.innerHTML += `<loader></loader>`;
		} else {
			btn.querySelector("loader").remove();
		}
	}

	open() {
		this.dialog.showModal();
	}
}
