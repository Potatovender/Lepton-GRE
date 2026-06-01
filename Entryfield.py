""" Astra Rendering Engine
Module Description
=====================
This module contains the DataEntryField abstract class which contains most of the main
======================
Matthew Chen, Justin Ng, Cindy Liu, Lingnan Meng
"""
import pygame
TEXTBOX_Y = 50
TEXTBOX_WIDTH, TEXTBOX_HEIGHT = 300, 50


class DataEntryField:
    """
    Acts as a State Machine for each list item.
    """

    def __init__(self, index: int, list_ref: list):
        self.index = index
        self.Y = TEXTBOX_Y + (index * TEXTBOX_HEIGHT)
        self.y = self.Y
        self.rect = pygame.Rect(0, self.y, TEXTBOX_WIDTH, TEXTBOX_HEIGHT)
        # Dicts for horizontal scrolling and subfield cursors
        self.scrolls = {"id": 0, "data": 0}
        self.cursors = {}

        # Determine if this is a populated field or the "New" generation field at the bottom
        if index < len(list_ref):
            self.id_str = list_ref[index][0]
            self.data_str = list_ref[index][1]
        else:
            self.id_str = ""
            self.data_str = ""

        self.cursors["id"] = len(self.id_str)
        self.cursors["data"] = len(self.data_str)

        # Backups for when the user clicks off (Cancels)
        self.backup_id = self.id_str
        self.backup_data = self.data_str

        # State flags
        self.editing_id = False
        self.editing_data = False

    def draw(self, surface: pygame.Surface):
        """Draws the UI field component, backgrounds, values, and cursors on the surface."""
        raise NotImplementedError()

    def handle_click(self, mouse_pos) -> bool:
        """
        Handles mouse input for setting focus.
        Returns True if the 'Enter' button was clicked and confirmed.
        """
        raise NotImplementedError()

    def handle_keydown(self, event):
        """Processes character and navigation keys when this field is active."""
        raise NotImplementedError()

    def cancel(self):
        """Reverts the field to what it had originally without changing data."""
        self.id_str = self.backup_id
        self.data_str = self.backup_data
        self.editing_id = False
        self.editing_data = False

    def confirm(self) -> bool:
        """
        Saves the edited contents back into the data registry arrays.
        Changes list indices, applies bounds, and triggers the AST dictionary rebuild.
        Returns True to signify the state actually changed.
        """
        raise NotImplementedError()
