""" Astra Rendering Engine
Module Description
=====================
This module contains the main loop
======================
Matthew Chen, Justin Ng, Cindy Liu, Lingnan Meng
"""
from __future__ import annotations  # MUST be at the very top of the file
import sys
import pygame
import pyperclip

# Import your custom classes
from equation import Equation
from color import Color
from boundary import Boundary
from Entryfield import DataEntryField

# Define screen and drawing boundaries
WIDTH, HEIGHT = 1100, 800
DRAW_MIN_X, DRAW_MAX_X = 300, WIDTH
DRAW_MIN_Y, DRAW_MAX_Y = 0, HEIGHT
TEXTBOX_Y = 50
TEXTBOX_WIDTH, TEXTBOX_HEIGHT = 300, 50
TEXTBOX_COLOR = (240, 240, 240)
INDENT_COLOR = (200, 200, 200)
TEXT_COLOR = (10, 10, 10)
TABS_WIDTH, TABS_HEIGHT = 60, 50
PANELS = ['Functions', 'Colors', 'Restrictions', 'Draw', 'Settings']
current_panel = 'Functions'

# Settings & AST Globals
ANGLE_MODE = "radians"
SCREEN_SIZE_OPTIONS = [(900, 700), (1100, 800), (1280, 900), (1400, 1000), (1600, 1000)]
SCREEN_SIZE_INDEX = 1

WARNING_TOTAL_GRID_POINTS = 90000
MAX_TOTAL_GRID_POINTS = 4194304
settings_buttons = {}
settings_values = {
    "x_min": "-15.0",
    "x_points": "100",
    "x_max": "15.0",
    "y_min": "-15.0",
    "y_points": "100",
    "y_max": "15.0",
    "max_recursion": "0"
}

active_settings_field = None
settings_scrolls = {}
settings_cursors = {}
# Holds the raw import/export text shown in the Settings tab
settings_transfer_text = ""

# Small status message shown under the import/export buttons
settings_transfer_status = ""

GRAPH_SURFACE = None

MAX_DEPTH = 100
scroll_y_vals = [0, 0, 0, 0]
# use scroll_y_vals for the scrolling amounts on each tab

# --- GLOBAL STATE ---
# Note: IDs here do NOT contain the semicolon.
# Semicolons are only used inside the math strings (e.g., "sin(;eq)")
functionsList = [
]

functionsDict = {}
colorsList = []
colorsDict = {}
restrictionsList = []
restrictionsDict = {}
drawList = []
drawFinal = []

# Maps list index -> ((R, G, B), "Error Message")
error_states = {}
color_error_states = {}
restriction_error_states = {}
draw_error_states = {}
settings_error_states = {}

pygame.init()


pygame.key.set_repeat(500, 50)
font = pygame.font.SysFont(None, 24)
small_font = pygame.font.SysFont(None, 18)

# flag colours
GREY = (150, 150, 150)
RED = (200, 50, 50)
BLUE = (50, 100, 200)
GREEN = (50, 200, 50)
YELLOW = (200, 200, 50)


def calculate_draw_bounds(xrange: float, yrange: float):
    """
    Forces the drawing area to remain the correct ratio to prevent stretching.
    This will need to be edited to allow for rectangular grids
    """
    global DRAW_MIN_X, DRAW_MAX_X, DRAW_MIN_Y, DRAW_MAX_Y

    # Calculate available space outside the 300px sidebar
    available_w = max(1, WIDTH - TEXTBOX_WIDTH)
    available_h = max(1, HEIGHT)

    # grid size horizontally
    grid_size_x = min(available_w, int(available_h * xrange / yrange))
    grid_size_y = min(available_w * yrange / xrange, available_h)

    # Center the square in the available space
    DRAW_MIN_X = TEXTBOX_WIDTH + (available_w - grid_size_x) // 2
    DRAW_MAX_X = DRAW_MIN_X + grid_size_x
    DRAW_MIN_Y = (available_h - grid_size_y) // 2
    DRAW_MAX_Y = DRAW_MIN_Y + grid_size_y


class FunctionsEntryField(DataEntryField):
    """
    Acts as a State Machine for each list item in the Functions Tab.
    """

    def __init__(self, index: int, list_ref: list):
        super().__init__(index, list_ref)

        # Sub-rectangles for hit-testing
        self.id_rect = pygame.Rect(30, self.y + 10, 50, 30)
        self.data_rect = pygame.Rect(85, self.y + 10, 150, 30)
        self.btn_enter = pygame.Rect(240, self.y + 10, 50, 30)

    def draw(self, surface: pygame.Surface) -> None:
        """
            Draws all textboxes/rectangle hitboxes in the Functions tab
            Draws the cooresponding text and text input line
        """
        # Draw background
        is_active = self.editing_id or self.editing_data
        bg_color = INDENT_COLOR if is_active else TEXTBOX_COLOR
        pygame.draw.rect(surface, bg_color, self.rect)
        pygame.draw.rect(surface, (150, 150, 150), self.rect, 1)  # Border

        # Added for Scrolling
        self.y = self.Y + scroll_y_vals[0]
        self.rect.y = self.y
        self.id_rect.y = self.y + 10
        self.data_rect.y = self.y + 10
        self.btn_enter.y = self.y + 10

        if self.y + TEXTBOX_HEIGHT < TABS_HEIGHT or self.y > HEIGHT:
            return

        # 1. Error Flagging
        # Fetch the color from our global error_states dict based on this field's index.
        # Defaults to Grey if not found.
        flag_color = error_states.get(self.index, ((150, 150, 150), ""))[0]
        pygame.draw.circle(surface, flag_color, (15, self.y + 25), 6)

        # 2. Draw ID Field
        pygame.draw.rect(surface, (255, 255, 255) if self.editing_id else bg_color, self.id_rect)
        id_surf = font.render(self.id_str, True, TEXT_COLOR)
        id_clip = pygame.Rect(self.scrolls.get("id", 0), 0, self.id_rect.width - 5, self.id_rect.height)
        surface.blit(id_surf, (self.id_rect.x + 5, self.id_rect.y + 7), id_clip)

        # 3. Draw Data Field (With Scrolling/Clipping)
        pygame.draw.rect(surface, (255, 255, 255) if self.editing_data else bg_color, self.data_rect)

        # ast_to_string logic: if NOT editing, show the formatted AST string
        display_str = self.data_str
        if not is_active and self.id_str in functionsDict:
            try:
                display_str = functionsDict[self.id_str].ast_to_string()
            except AttributeError:
                pass

        data_surf = font.render(display_str, True, TEXT_COLOR)

        # Scroll through text entry field natively via subsurface clipping
        # Added horizantal scrolling(left and right key)
        data_scroll = self.scrolls.get("data", 0)
        clip_area = pygame.Rect(data_scroll, 0, self.data_rect.width - 5, self.data_rect.height)
        surface.blit(data_surf, (self.data_rect.x + 5, self.data_rect.y + 7), clip_area)

        max_scroll = max(0, data_surf.get_width() - (self.data_rect.width - 5))
        self.scrolls["data"] = max(0, min(data_scroll, max_scroll))

        # 4. Draw Confirm "Enter" Button
        if is_active:
            pygame.draw.rect(surface, (100, 200, 100), self.btn_enter)
            btn_txt = small_font.render("ENTER", True, (0, 0, 0))
            surface.blit(btn_txt, (self.btn_enter.x + 5, self.btn_enter.y + 10))

        if self.editing_id:
            cursor_x = (self.id_rect.x + 5 + font.size(self.id_str[:self.cursors.get("id", len(self.id_str))])[0] -
                        self.scrolls.get("id", 0))
            cursor_y = self.id_rect.y + 5
            pygame.draw.line(surface, (0, 0, 0), (cursor_x, cursor_y), (cursor_x, cursor_y + 20), 2)

        if self.editing_data:
            cursor_x = self.data_rect.x + 5 + font.size(
                self.data_str[:self.cursors.get("data", len(self.data_str))])[0] - self.scrolls.get("data", 0)
            cursor_y = self.data_rect.y + 5
            pygame.draw.line(surface, (0, 0, 0), (cursor_x, cursor_y), (cursor_x, cursor_y + 20), 2)

    def handle_click(self, mouse_pos) -> bool:
        """Returns True if the 'Enter' button was clicked and confirmed."""
        if self.id_rect.collidepoint(mouse_pos):
            self.editing_id = True
            self.editing_data = False

            cursor_pos = mouse_pos[0] - (self.id_rect.x + 5) + self.scrolls.get("id", 0)
            font_widths = [font.size(self.id_str[:i])[0] for i in range(len(self.id_str) + 1)]
            self.cursors["id"] = min(range(len(font_widths)), key=lambda i: abs(font_widths[i] - cursor_pos))
            cursor_pixel = font.size(self.id_str[:self.cursors["id"]])[0]

            if cursor_pixel > self.id_rect.width - 10:
                self.scrolls["id"] = cursor_pixel - (self.id_rect.width - 10)
            else:
                self.scrolls["id"] = 0

        elif self.data_rect.collidepoint(mouse_pos):
            self.editing_data = True
            self.editing_id = False
            # Find cursor position
            cursor_pos = mouse_pos[0] - (self.data_rect.x + 5) + self.scrolls.get("data", 0)
            display_str = self.data_str
            font_widths = [font.size(display_str[:i])[0] for i in range(len(display_str) + 1)]
            # Set the cursor to the nearest character
            self.cursors["data"] = min(range(len(font_widths)), key=lambda i: abs(font_widths[i] - cursor_pos))
            # Autoscroll text such that the cursor remains visible
            cursor_pixel = font.size(self.data_str[:self.cursors["data"]])[0]

            if cursor_pixel > self.data_rect.width - 10:
                self.scrolls["data"] = cursor_pixel - (self.data_rect.width - 10)
            else:
                self.scrolls["data"] = 0

        elif self.btn_enter.collidepoint(mouse_pos) and (self.editing_id or self.editing_data):
            return self.confirm()
        return False

    def handle_keydown(self, event):
        """
            handles text changes or modifications based on keyboard inputs
        """
        if self.editing_id:
            cursor_pos_id = self.cursors.get("id", len(self.id_str))
            if event.key == pygame.K_BACKSPACE:
                if cursor_pos_id > 0:
                    self.id_str = self.id_str[:cursor_pos_id - 1] + self.id_str[cursor_pos_id:]
                    self.cursors["id"] -= 1
            elif event.key == pygame.K_LEFT:
                self.cursors["id"] = max(0, cursor_pos_id - 1)
            elif event.key == pygame.K_RIGHT:
                self.cursors["id"] = min(len(self.id_str), cursor_pos_id + 1)
            else:
                self.id_str = self.id_str[:cursor_pos_id] + event.unicode + self.id_str[cursor_pos_id:]
                self.cursors["id"] += 1

            cursor_pixel = font.size(self.id_str[:self.cursors["id"]])[0]
            visible_width = self.id_rect.width - 10
            scroll_id = self.scrolls.get("id", 0)

            if cursor_pixel - scroll_id > visible_width:
                self.scrolls["id"] = cursor_pixel - visible_width
            elif cursor_pixel - scroll_id < 0:
                self.scrolls["id"] = cursor_pixel

        elif self.editing_data:
            cursor_pos_data = self.cursors.get("data", len(self.data_str))
            if event.key == pygame.K_BACKSPACE:
                if cursor_pos_data > 0:
                    self.data_str = (
                            self.data_str[:cursor_pos_data - 1] +
                            self.data_str[cursor_pos_data:]
                    )
                    self.cursors["data"] -= 1

            elif event.key == pygame.K_LEFT:
                self.cursors["data"] = max(0, cursor_pos_data - 1)
            elif event.key == pygame.K_RIGHT:
                self.cursors["data"] = min(len(self.data_str), cursor_pos_data + 1)
            else:
                self.data_str = (
                    self.data_str[:cursor_pos_data] +
                    event.unicode +
                    self.data_str[cursor_pos_data:])
                self.cursors["data"] += 1

            cursor_pixel = font.size(self.data_str[:self.cursors["data"]])[0]
            visible_width = self.data_rect.width - 10
            scroll_data = self.scrolls.get("data", 0)

            if cursor_pixel - scroll_data > visible_width:
                self.scrolls["data"] = cursor_pixel - visible_width

            elif cursor_pixel - scroll_data < 0:
                self.scrolls["data"] = cursor_pixel

    def cancel(self):
        """Reverts the field to its pre-edited state without saving changes."""
        self.id_str = self.backup_id
        self.data_str = self.backup_data
        self.editing_id = False
        self.editing_data = False

    def confirm(self) -> bool:
        """
        Saves the textbox data into the global Functions list.
        Deletes the field if empty, rebuilds dictionaries, and returns True.
        """
        global functionsList
        if self.index < len(functionsList):
            if self.id_str.strip() == "" and self.data_str.strip() == "":
                functionsList.pop(self.index)
            else:
                functionsList[self.index] = (self.id_str, self.data_str)
        else:
            if self.id_str.strip() != "":
                functionsList.append((self.id_str, self.data_str))

        self.backup_id = self.id_str
        self.backup_data = self.data_str
        self.editing_id = False
        self.editing_data = False

        update_functions()
        return True  # Signals the main loop that we need to recalculate the math grid


class ColorsEntryField(DataEntryField):
    """
    Replaces the Textbox. Acts as a State Machine for each list item. Contains vital information for hitboxes in Pygame
    """
    data_index: int

    def __init__(self, index: int, list_ref: list):
        super().__init__(index, list_ref)

        # three data_str (including data_str) values for r, g, and b values
        if index < len(list_ref):
            self.data_str_g = list_ref[index][2]
            self.data_str_b = list_ref[index][3]
        else:
            self.data_str_g = ""
            self.data_str_b = ""

        # three backups including backup_str
        self.backup_data_g = self.data_str_g
        self.backup_data_b = self.data_str_b

        # Sub-rectangles for hit-testing
        self.id_rect = pygame.Rect(30, self.y + 10, 50, 30)
        self.full_data_rect = pygame.Rect(85, self.y + 10, 150, 30)
        self.data_rect1 = pygame.Rect(85, self.y + 10, 50, 30)
        self.data_rect2 = pygame.Rect(135, self.y + 10, 50, 30)
        self.data_rect3 = pygame.Rect(185, self.y + 10, 50, 30)
        self.btn_enter = pygame.Rect(240, self.y + 10, 50, 30)
        self.data_index = 0

    def draw(self, surface: pygame.Surface) -> None:
        """
            Draws all textboxes/rectangle hitboxes in the Colours tab
            Draws the cooresponding text and text input line
        """
        # Draw background
        is_active = self.editing_id or self.editing_data
        bg_color = INDENT_COLOR if is_active else TEXTBOX_COLOR
        pygame.draw.rect(surface, bg_color, self.rect)
        pygame.draw.rect(surface, (150, 150, 150), self.rect, 1)  # Border

        # Added for Scrolling, not sure if it's correct
        self.y = self.Y + scroll_y_vals[1]
        self.rect.y = self.y
        self.id_rect.y = self.y + 10
        self.data_rect1.y = self.y + 10
        self.data_rect2.y = self.y + 10
        self.data_rect3.y = self.y + 10
        self.btn_enter.y = self.y + 10

        if self.y + TEXTBOX_HEIGHT < TABS_HEIGHT or self.y > HEIGHT:
            return

        # 1. Error Flagging
        # Fetch the color from our global error_states dict based on this field's index.
        # Defaults to Grey if not found.
        flag_color = color_error_states.get(self.index, ((150, 150, 150), ""))[0]
        pygame.draw.circle(surface, flag_color, (15, self.y + 25), 6)

        # 2. Draw ID Field
        pygame.draw.rect(surface, (255, 255, 255) if self.editing_id else bg_color, self.id_rect)
        id_surf = font.render(self.id_str, True, TEXT_COLOR)
        id_clip = pygame.Rect(self.scrolls.get("id", 0), 0, self.id_rect.width - 5, self.id_rect.height)
        surface.blit(id_surf, (self.id_rect.x + 5, self.id_rect.y + 7), id_clip)

        # 3. Draw 3 Data Fields (With Scrolling/Clipping)
        pygame.draw.rect(surface, (255, 255, 255) if self.editing_data and self.data_index == 0 else bg_color,
                         self.data_rect1)
        pygame.draw.rect(surface, (255, 255, 255) if self.editing_data and self.data_index == 1 else bg_color,
                         self.data_rect2)
        pygame.draw.rect(surface, (255, 255, 255) if self.editing_data and self.data_index == 2 else bg_color,
                         self.data_rect3)

        # ast_to_string logic: if NOT editing, show the formatted AST string
        display_str = self.data_str
        display_str2 = self.data_str_g
        display_str3 = self.data_str_b

        if not is_active and self.id_str in functionsDict:
            try:
                display_str = colorsDict[self.id_str].ast_to_string()
            except AttributeError:
                pass

        data_surf = font.render(display_str, True, TEXT_COLOR)
        data_surf2 = font.render(display_str2, True, TEXT_COLOR)
        data_surf3 = font.render(display_str3, True, TEXT_COLOR)

        # Scroll through text entry field natively via subsurface clipping
        # Added horizantal scrolling(left and right key)
        scroll0 = self.scrolls.get("data0", 0)
        clip_area = pygame.Rect(scroll0, 0, self.data_rect1.width - 5, self.data_rect1.height)
        surface.blit(data_surf, (self.data_rect1.x + 5, self.data_rect1.y + 7), clip_area)
        max_scroll = max(0, data_surf.get_width() - (self.data_rect1.width - 5))
        self.scrolls["data0"] = max(0, min(scroll0, max_scroll))

        # scroll for rectangle 2 (g)
        scroll1 = self.scrolls.get("data1", 0)
        clip_area = pygame.Rect(scroll1, 0, self.data_rect2.width - 5, self.data_rect2.height)
        surface.blit(data_surf2, (self.data_rect2.x + 5, self.data_rect2.y + 7), clip_area)
        max_scroll = max(0, data_surf2.get_width() - (self.data_rect2.width - 5))
        self.scrolls["data1"] = max(0, min(scroll1, max_scroll))

        # scroll for rectangle 3 (b)
        scroll2 = self.scrolls.get("data2", 0)
        clip_area = pygame.Rect(scroll2, 0, self.data_rect3.width - 5, self.data_rect3.height)
        surface.blit(data_surf3, (self.data_rect3.x + 5, self.data_rect3.y + 7), clip_area)
        max_scroll = max(0, data_surf3.get_width() - (self.data_rect3.width - 5))
        self.scrolls["data2"] = max(0, min(scroll2, max_scroll))

        # 4. Draw Confirm "Enter" Button
        if is_active:
            pygame.draw.rect(surface, (100, 200, 100), self.btn_enter)
            btn_txt = small_font.render("ENTER", True, (0, 0, 0))
            surface.blit(btn_txt, (self.btn_enter.x + 5, self.btn_enter.y + 10))

        if self.editing_id:
            cursor_x = (self.id_rect.x + 5 + font.size(self.id_str[:self.cursors.get("id", len(self.id_str))])[0] -
                        self.scrolls.get("id", 0))
            cursor_y = self.id_rect.y + 5
            pygame.draw.line(surface, (0, 0, 0), (cursor_x, cursor_y), (cursor_x, cursor_y + 20), 2)

        if self.editing_data:
            key = f"data{self.data_index}"
            active_str = self.data_str if self.data_index == 0 else (self.data_str_g if self.data_index == 1 else
                                                                     self.data_str_b)
            active_rect = self.data_rect1 if self.data_index == 0 else (self.data_rect2 if self.data_index == 1 else
                                                                        self.data_rect3)
            cursor_x = (active_rect.x + 5 + font.size(active_str[:self.cursors.get(key, len(active_str))])[0] -
                        self.scrolls.get(key, 0))
            cursor_y = active_rect.y + 5
            pygame.draw.line(surface, (0, 0, 0), (cursor_x, cursor_y), (cursor_x, cursor_y + 20), 2)

    def handle_click(self, mouse_pos) -> bool:
        """Returns True if the 'Enter' button was clicked and confirmed."""
        if self.id_rect.collidepoint(mouse_pos):
            self.editing_id = True
            self.editing_data = False
            cursor_pos = mouse_pos[0] - (self.id_rect.x + 5) + self.scrolls.get("id", 0)
            font_widths = [font.size(self.id_str[:i])[0] for i in range(len(self.id_str) + 1)]
            self.cursors["id"] = min(range(len(font_widths)), key=lambda i: abs(font_widths[i] - cursor_pos))
            cursor_pixel = font.size(self.id_str[:self.cursors["id"]])[0]
            if cursor_pixel > self.id_rect.width - 10:
                self.scrolls["id"] = cursor_pixel - (self.id_rect.width - 10)
            else:
                self.scrolls["id"] = 0

        elif self.full_data_rect.collidepoint(mouse_pos):
            self.editing_data = True
            self.editing_id = False

            if self.data_rect1.collidepoint(mouse_pos):
                self.data_index = 0
                active_rect = self.data_rect1
                active_str = self.data_str
            elif self.data_rect2.collidepoint(mouse_pos):
                self.data_index = 1
                active_rect = self.data_rect2
                active_str = self.data_str_g
            elif self.data_rect3.collidepoint(mouse_pos):
                self.data_index = 2
                active_rect = self.data_rect3
                active_str = self.data_str_b
            else:
                return False

            key = f"data{self.data_index}"
            cursor_pos = mouse_pos[0] - (active_rect.x + 5) + self.scrolls.get(key, 0)
            font_widths = [font.size(active_str[:i])[0] for i in range(len(active_str) + 1)]
            self.cursors[key] = min(range(len(font_widths)), key=lambda i: abs(font_widths[i] - cursor_pos))
            cursor_pixel = font.size(active_str[:self.cursors[key]])[0]
            if cursor_pixel > active_rect.width - 10:
                self.scrolls[key] = cursor_pixel - (active_rect.width - 10)
            else:
                self.scrolls[key] = 0

        elif self.btn_enter.collidepoint(mouse_pos) and (self.editing_id or self.editing_data):
            return self.confirm()
        return False

    def handle_keydown(self, event) -> None:
        """
            handles text changes or modifications based on keyboard inputs
        """
        if self.editing_id:
            cursor_pos_id = self.cursors.get("id", len(self.id_str))
            if event.key == pygame.K_BACKSPACE:
                if cursor_pos_id > 0:
                    self.id_str = self.id_str[:cursor_pos_id - 1] + self.id_str[cursor_pos_id:]
                    self.cursors["id"] -= 1
            elif event.key == pygame.K_LEFT:
                self.cursors["id"] = max(0, cursor_pos_id - 1)
            elif event.key == pygame.K_RIGHT:
                self.cursors["id"] = min(len(self.id_str), cursor_pos_id + 1)
            else:
                self.id_str = self.id_str[:cursor_pos_id] + event.unicode + self.id_str[cursor_pos_id:]
                self.cursors["id"] += 1

            cursor_pixel_id = font.size(self.id_str[:self.cursors["id"]])[0]
            visible_width_id = self.id_rect.width - 10
            scroll_id = self.scrolls.get("id", 0)
            if cursor_pixel_id - scroll_id > visible_width_id:
                self.scrolls["id"] = cursor_pixel_id - visible_width_id
            elif cursor_pixel_id - scroll_id < 0:
                self.scrolls["id"] = cursor_pixel_id

        elif self.editing_data:
            key = f"data{self.data_index}"
            active_str = self.data_str if self.data_index == 0 else (self.data_str_g if self.data_index == 1 else
                                                                     self.data_str_b)
            cursor_pos = self.cursors.get(key, len(active_str))

            if event.key == pygame.K_BACKSPACE:
                if cursor_pos > 0:
                    if self.data_index == 0:
                        self.data_str = self.data_str[:cursor_pos - 1] + self.data_str[cursor_pos:]
                    elif self.data_index == 1:
                        self.data_str_g = self.data_str_g[:cursor_pos - 1] + self.data_str_g[cursor_pos:]
                    elif self.data_index == 2:
                        self.data_str_b = self.data_str_b[:cursor_pos - 1] + self.data_str_b[cursor_pos:]
                    self.cursors[key] -= 1
            elif event.key == pygame.K_LEFT:
                self.cursors[key] = max(0, cursor_pos - 1)
            elif event.key == pygame.K_RIGHT:
                self.cursors[key] = min(len(active_str), cursor_pos + 1)
            else:
                if self.data_index == 0:
                    self.data_str = self.data_str[:cursor_pos] + event.unicode + self.data_str[cursor_pos:]
                elif self.data_index == 1:
                    self.data_str_g = self.data_str_g[:cursor_pos] + event.unicode + self.data_str_g[cursor_pos:]
                elif self.data_index == 2:
                    self.data_str_b = self.data_str_b[:cursor_pos] + event.unicode + self.data_str_b[cursor_pos:]
                self.cursors[key] = cursor_pos + 1

            active_str = self.data_str if self.data_index == 0 else (self.data_str_g if self.data_index == 1 else
                                                                     self.data_str_b)
            cursor_pixel = font.size(active_str[:self.cursors[key]])[0]
            visible_width = 40  # 50 - 10
            scroll = self.scrolls.get(key, 0)

            if cursor_pixel - scroll > visible_width:
                self.scrolls[key] = cursor_pixel - visible_width
            elif cursor_pixel - scroll < 0:
                self.scrolls[key] = cursor_pixel

    def cancel(self):
        """Reverts the field to what it had originally without changing data."""
        self.id_str = self.backup_id
        self.data_str = self.backup_data
        self.data_str_g = self.backup_data_g
        self.data_str_b = self.backup_data_b
        self.editing_id = False
        self.editing_data = False

    def confirm(self) -> bool:
        """Saves current fields to the global Colors list, discarding if entirely empty."""
        global colorsList
        if self.index < len(colorsList):
            if (self.id_str.strip() == "" and self.data_str.strip() == "" and self.data_str_g.strip() == "" and
                    self.data_str_b.strip() == ""):
                colorsList.pop(self.index)
            else:
                colorsList[self.index] = (self.id_str, self.data_str, self.data_str_g, self.data_str_b)
        else:
            if self.id_str.strip() != "":
                colorsList.append((self.id_str, self.data_str, self.data_str_g, self.data_str_b))

        self.backup_id = self.id_str
        self.backup_data = self.data_str
        self.backup_data_g = self.data_str_g
        self.backup_data_b = self.data_str_b
        self.editing_id = False
        self.editing_data = False

        update_functions()
        return True  # Signals the main loop that we need to recalculate the math grid


class RestrictionsEntryField(DataEntryField):
    """
    Entry field for Restrictions tab: ID, Target ID, and Boolean toggle
    """
    def __init__(self, index: int, list_ref: list):
        super().__init__(index, list_ref)
        if index < len(list_ref):
            self.checkSmaller = list_ref[index][2]
        else:
            self.checkSmaller = False

        self.backup_checkSmaller = self.checkSmaller

        # Sub-rectangles for hit-testing
        self.id_rect = pygame.Rect(30, self.y + 10, 50, 30)
        self.full_data_rect = pygame.Rect(85, self.y + 10, 150, 30)  # for generic click checking
        self.data_rect1 = pygame.Rect(85, self.y + 10, 110, 30)  # for the target func id
        self.bool_rect = pygame.Rect(200, self.y + 10, 35, 30)  # for the boolean toggler
        self.btn_enter = pygame.Rect(240, self.y + 10, 50, 30)

    def draw(self, surface: pygame.Surface) -> None:
        """
            Draws all textboxes/rectangle hitboxes in the Restrictions tab
            Draws the cooresponding text and text input line
        """
        is_active = self.editing_id or self.editing_data
        bg_color = INDENT_COLOR if is_active else TEXTBOX_COLOR
        pygame.draw.rect(surface, bg_color, self.rect)
        pygame.draw.rect(surface, (150, 150, 150), self.rect, 1)

        self.y = self.Y + scroll_y_vals[2]
        self.rect.y = self.y
        self.id_rect.y = self.y + 10
        self.data_rect1.y = self.y + 10
        self.bool_rect.y = self.y + 10
        self.full_data_rect.y = self.y + 10
        self.btn_enter.y = self.y + 10

        if self.y + TEXTBOX_HEIGHT < TABS_HEIGHT or self.y > HEIGHT:
            return

        # Status Flag
        flag_color = restriction_error_states.get(self.index, ((150, 150, 150), ""))[0]
        pygame.draw.circle(surface, flag_color, (15, self.y + 25), 6)

        # ID Field
        pygame.draw.rect(surface, (255, 255, 255) if self.editing_id else bg_color, self.id_rect)
        id_surf = font.render(self.id_str, True, TEXT_COLOR)
        id_clip = pygame.Rect(self.scrolls.get("id", 0), 0, self.id_rect.width - 5, self.id_rect.height)
        surface.blit(id_surf, (self.id_rect.x + 5, self.id_rect.y + 7), id_clip)

        # Target Func Field
        pygame.draw.rect(surface, (255, 255, 255) if self.editing_data else bg_color, self.data_rect1)
        data_surf = font.render(self.data_str, True, TEXT_COLOR)
        scroll_data = self.scrolls.get("data", 0)
        clip_area = pygame.Rect(scroll_data, 0, self.data_rect1.width - 5, self.data_rect1.height)
        surface.blit(data_surf, (self.data_rect1.x + 5, self.data_rect1.y + 7), clip_area)
        max_scroll = max(0, data_surf.get_width() - (self.data_rect1.width - 5))
        self.scrolls["data"] = max(0, min(scroll_data, max_scroll))

        # Boolean Field
        pygame.draw.rect(surface, bg_color, self.bool_rect)
        pygame.draw.rect(surface, (0, 0, 0), self.bool_rect, 1)
        # Display <= 0 or >= 0 based on checkSmaller
        bool_str = "<= 0" if self.checkSmaller else ">= 0"
        bool_surf = small_font.render(bool_str, True, TEXT_COLOR)
        surface.blit(bool_surf, (self.bool_rect.x + 2, self.bool_rect.y + 10))

        if is_active:
            pygame.draw.rect(surface, (100, 200, 100), self.btn_enter)
            btn_txt = small_font.render("ENTER", True, (0, 0, 0))
            surface.blit(btn_txt, (self.btn_enter.x + 5, self.btn_enter.y + 10))

        if self.editing_id:
            cursor_x = (self.id_rect.x + 5 + font.size(self.id_str[:self.cursors.get("id", len(self.id_str))])[0] -
                        self.scrolls.get("id", 0))
            cursor_y = self.id_rect.y + 5
            pygame.draw.line(surface, (0, 0, 0), (cursor_x, cursor_y), (cursor_x, cursor_y + 20), 2)

        if self.editing_data:
            cursor_x = self.data_rect1.x + 5 + font.size(
                self.data_str[:self.cursors.get("data", len(self.data_str))])[0] - self.scrolls.get("data", 0)
            cursor_y = self.data_rect1.y + 5
            pygame.draw.line(surface, (0, 0, 0), (cursor_x, cursor_y), (cursor_x, cursor_y + 20), 2)

    def handle_click(self, mouse_pos) -> bool:
        """Returns True if the 'Enter' button was clicked and confirmed."""
        if self.id_rect.collidepoint(mouse_pos):
            self.editing_id = True
            self.editing_data = False
            cursor_pos = mouse_pos[0] - (self.id_rect.x + 5) + self.scrolls.get("id", 0)
            font_widths = [font.size(self.id_str[:i])[0] for i in range(len(self.id_str) + 1)]
            self.cursors["id"] = min(range(len(font_widths)), key=lambda i: abs(font_widths[i] - cursor_pos))
            cursor_pixel = font.size(self.id_str[:self.cursors["id"]])[0]
            if cursor_pixel > self.id_rect.width - 10:
                self.scrolls["id"] = cursor_pixel - (self.id_rect.width - 10)
            else:
                self.scrolls["id"] = 0

        elif self.data_rect1.collidepoint(mouse_pos):
            self.editing_data = True
            self.editing_id = False
            cursor_pos = mouse_pos[0] - (self.data_rect1.x + 5) + self.scrolls.get("data", 0)
            font_widths = [font.size(self.data_str[:i])[0] for i in range(len(self.data_str) + 1)]
            self.cursors["data"] = min(range(len(font_widths)), key=lambda i: abs(font_widths[i] - cursor_pos))
            cursor_pixel = font.size(self.data_str[:self.cursors["data"]])[0]
            if cursor_pixel > self.data_rect1.width - 10:
                self.scrolls["data"] = cursor_pixel - (self.data_rect1.width - 10)
            else:
                self.scrolls["data"] = 0

        elif self.bool_rect.collidepoint(mouse_pos):
            self.checkSmaller = not self.checkSmaller
            self.editing_data = True
            self.editing_id = False
        elif self.btn_enter.collidepoint(mouse_pos) and (self.editing_id or self.editing_data):
            return self.confirm()
        return False

    def handle_keydown(self, event) -> None:
        """
            handles text changes or modifications based on keyboard inputs
        """
        if self.editing_id:
            cursor_pos_id = self.cursors.get("id", len(self.id_str))
            if event.key == pygame.K_BACKSPACE:
                if cursor_pos_id > 0:
                    self.id_str = self.id_str[:cursor_pos_id - 1] + self.id_str[cursor_pos_id:]
                    self.cursors["id"] -= 1
            elif event.key == pygame.K_LEFT:
                self.cursors["id"] = max(0, cursor_pos_id - 1)
            elif event.key == pygame.K_RIGHT:
                self.cursors["id"] = min(len(self.id_str), cursor_pos_id + 1)
            else:
                self.id_str = self.id_str[:cursor_pos_id] + event.unicode + self.id_str[cursor_pos_id:]
                self.cursors["id"] += 1

            cursor_pixel_id = font.size(self.id_str[:self.cursors["id"]])[0]
            visible_width_id = self.id_rect.width - 10
            scroll_id = self.scrolls.get("id", 0)
            if cursor_pixel_id - scroll_id > visible_width_id:
                self.scrolls["id"] = cursor_pixel_id - visible_width_id
            elif cursor_pixel_id - scroll_id < 0:
                self.scrolls["id"] = cursor_pixel_id

        elif self.editing_data:
            cursor_pos_data = self.cursors.get("data", len(self.data_str))
            if event.key == pygame.K_BACKSPACE:
                if cursor_pos_data > 0:
                    self.data_str = self.data_str[:cursor_pos_data - 1] + self.data_str[cursor_pos_data:]
                    self.cursors["data"] -= 1
            elif event.key == pygame.K_LEFT:
                self.cursors["data"] = max(0, cursor_pos_data - 1)
            elif event.key == pygame.K_RIGHT:
                self.cursors["data"] = min(len(self.data_str), cursor_pos_data + 1)
            else:
                self.data_str = self.data_str[:cursor_pos_data] + event.unicode + self.data_str[cursor_pos_data:]
                self.cursors["data"] += 1

            cursor_pixel = font.size(self.data_str[:self.cursors["data"]])[0]
            visible_width = self.data_rect1.width - 10
            scroll_data = self.scrolls.get("data", 0)
            if cursor_pixel - scroll_data > visible_width:
                self.scrolls["data"] = cursor_pixel - visible_width
            elif cursor_pixel - scroll_data < 0:
                self.scrolls["data"] = cursor_pixel

    def cancel(self):
        self.id_str = self.backup_id
        self.data_str = self.backup_data
        self.checkSmaller = self.backup_checkSmaller
        self.editing_id = False
        self.editing_data = False

    def confirm(self) -> bool:
        global restrictionsList
        if self.index < len(restrictionsList):
            if self.id_str.strip() == "" and self.data_str.strip() == "":
                restrictionsList.pop(self.index)
            else:
                restrictionsList[self.index] = (self.id_str, self.data_str, self.checkSmaller)
        else:
            if self.id_str.strip() != "":
                restrictionsList.append((self.id_str, self.data_str, self.checkSmaller))

        self.backup_id = self.id_str
        self.backup_data = self.data_str
        self.backup_checkSmaller = self.checkSmaller
        self.editing_id = False
        self.editing_data = False

        update_functions()
        return True


class DrawEntryField(DataEntryField):
    """
    Entry field for Draw tab: Func ID, Color ID, Rest ID
    """
    def __init__(self, index: int, list_ref: list):
        super().__init__(index, list_ref)
        if index < len(list_ref):
            self.data_str_c = list_ref[index][1]
            self.data_str_r = list_ref[index][2]
        else:
            self.data_str_c = ""
            self.data_str_r = ""

        self.backup_data_c = self.data_str_c
        self.backup_data_r = self.data_str_r

        self.id_rect = pygame.Rect(30, self.y + 10, 60, 30)   # func id
        self.full_data_rect = pygame.Rect(95, self.y + 10, 140, 30)
        self.data_rect1 = pygame.Rect(95, self.y + 10, 65, 30)  # color id
        self.data_rect2 = pygame.Rect(165, self.y + 10, 70, 30)  # rest id
        self.btn_enter = pygame.Rect(240, self.y + 10, 50, 30)
        self.data_index = 0

    def draw(self, surface: pygame.Surface) -> None:
        """
            Draws all textboxes/rectangle hitboxes in the Functions tab
            Draws the cooresponding text and text input line
        """
        is_active = self.editing_id or self.editing_data
        bg_color = INDENT_COLOR if is_active else TEXTBOX_COLOR
        pygame.draw.rect(surface, bg_color, self.rect)
        pygame.draw.rect(surface, (150, 150, 150), self.rect, 1)

        self.y = self.Y + scroll_y_vals[3]
        self.rect.y = self.y
        self.id_rect.y = self.y + 10
        self.data_rect1.y = self.y + 10
        self.data_rect2.y = self.y + 10
        self.full_data_rect.y = self.y + 10
        self.btn_enter.y = self.y + 10

        if self.y + TEXTBOX_HEIGHT < TABS_HEIGHT or self.y > HEIGHT:
            return

        # Status Flag
        flag_color = draw_error_states.get(self.index, ((150, 150, 150), ""))[0]
        pygame.draw.circle(surface, flag_color, (15, self.y + 25), 6)

        # Func ID (stored in id_str basically from super class)
        pygame.draw.rect(surface, (255, 255, 255) if self.editing_id else bg_color, self.id_rect)
        id_surf = font.render(self.id_str, True, TEXT_COLOR)
        id_clip = pygame.Rect(self.scrolls.get("id", 0), 0, self.id_rect.width - 5, self.id_rect.height)
        surface.blit(id_surf, (self.id_rect.x + 5, self.id_rect.y + 7), id_clip)

        # Color ID
        pygame.draw.rect(surface, (255, 255, 255) if self.editing_data and self.data_index == 0 else bg_color,
                         self.data_rect1)
        data_surf1 = font.render(self.data_str_c, True, TEXT_COLOR)
        scroll_data0 = self.scrolls.get("data0", 0)
        clip_area1 = pygame.Rect(scroll_data0, 0, self.data_rect1.width - 5, self.data_rect1.height)
        surface.blit(data_surf1, (self.data_rect1.x + 5, self.data_rect1.y + 7), clip_area1)
        max_scroll0 = max(0, data_surf1.get_width() - (self.data_rect1.width - 5))
        self.scrolls["data0"] = max(0, min(scroll_data0, max_scroll0))

        # Rest ID
        pygame.draw.rect(surface, (255, 255, 255) if self.editing_data and self.data_index == 1 else bg_color,
                         self.data_rect2)
        data_surf2 = font.render(self.data_str_r, True, TEXT_COLOR)
        scroll_data1 = self.scrolls.get("data1", 0)
        clip_area2 = pygame.Rect(scroll_data1, 0, self.data_rect2.width - 5, self.data_rect2.height)
        surface.blit(data_surf2, (self.data_rect2.x + 5, self.data_rect2.y + 7), clip_area2)
        max_scroll1 = max(0, data_surf2.get_width() - (self.data_rect2.width - 5))
        self.scrolls["data1"] = max(0, min(scroll_data1, max_scroll1))

        if is_active:
            pygame.draw.rect(surface, (100, 200, 100), self.btn_enter)
            btn_txt = small_font.render("ENTER", True, (0, 0, 0))
            surface.blit(btn_txt, (self.btn_enter.x + 5, self.btn_enter.y + 10))

        if self.editing_id:
            cursor_x = (self.id_rect.x + 5 + font.size(self.id_str[:self.cursors.get("id", len(self.id_str))])[0] -
                        self.scrolls.get("id", 0))
            cursor_y = self.id_rect.y + 5
            pygame.draw.line(surface, (0, 0, 0), (cursor_x, cursor_y), (cursor_x, cursor_y + 20), 2)

        if self.editing_data:
            key = f"data{self.data_index}"
            active_str = self.data_str_c if self.data_index == 0 else self.data_str_r
            active_rect = self.data_rect1 if self.data_index == 0 else self.data_rect2
            cursor_x = (active_rect.x + 5 + font.size(active_str[:self.cursors.get(key, len(active_str))])[0] -
                        self.scrolls.get(key, 0))
            cursor_y = active_rect.y + 5
            pygame.draw.line(surface, (0, 0, 0), (cursor_x, cursor_y), (cursor_x, cursor_y + 20), 2)

    def handle_click(self, mouse_pos) -> bool:
        """Returns True if the 'Enter' button was clicked and confirmed."""
        if self.id_rect.collidepoint(mouse_pos):
            self.editing_id = True
            self.editing_data = False
            cursor_pos = mouse_pos[0] - (self.id_rect.x + 5) + self.scrolls.get("id", 0)
            font_widths = [font.size(self.id_str[:i])[0] for i in range(len(self.id_str) + 1)]
            self.cursors["id"] = min(range(len(font_widths)), key=lambda i: abs(font_widths[i] - cursor_pos))
            cursor_pixel = font.size(self.id_str[:self.cursors["id"]])[0]
            if cursor_pixel > self.id_rect.width - 10:
                self.scrolls["id"] = cursor_pixel - (self.id_rect.width - 10)
            else:
                self.scrolls["id"] = 0

        elif self.full_data_rect.collidepoint(mouse_pos):
            self.editing_data = True
            self.editing_id = False
            if self.data_rect1.collidepoint(mouse_pos):
                self.data_index = 0
                active_rect = self.data_rect1
                active_str = self.data_str_c
            elif self.data_rect2.collidepoint(mouse_pos):
                self.data_index = 1
                active_rect = self.data_rect2
                active_str = self.data_str_r
            else:
                return False

            key = f"data{self.data_index}"
            cursor_pos = mouse_pos[0] - (active_rect.x + 5) + self.scrolls.get(key, 0)
            font_widths = [font.size(active_str[:i])[0] for i in range(len(active_str) + 1)]
            self.cursors[key] = min(range(len(font_widths)), key=lambda i: abs(font_widths[i] - cursor_pos))
            cursor_pixel = font.size(active_str[:self.cursors[key]])[0]
            if cursor_pixel > active_rect.width - 10:
                self.scrolls[key] = cursor_pixel - (active_rect.width - 10)
            else:
                self.scrolls[key] = 0
        elif self.btn_enter.collidepoint(mouse_pos) and (self.editing_id or self.editing_data):
            return self.confirm()
        return False

    def handle_keydown(self, event) -> None:
        """
            handles text changes or modifications based on keyboard inputs
        """
        if self.editing_id:
            cursor_pos_id = self.cursors.get("id", len(self.id_str))
            if event.key == pygame.K_BACKSPACE:
                if cursor_pos_id > 0:
                    self.id_str = self.id_str[:cursor_pos_id - 1] + self.id_str[cursor_pos_id:]
                    self.cursors["id"] -= 1
            elif event.key == pygame.K_LEFT:
                self.cursors["id"] = max(0, cursor_pos_id - 1)
            elif event.key == pygame.K_RIGHT:
                self.cursors["id"] = min(len(self.id_str), cursor_pos_id + 1)
            else:
                self.id_str = self.id_str[:cursor_pos_id] + event.unicode + self.id_str[cursor_pos_id:]
                self.cursors["id"] += 1

            cursor_pixel_id = font.size(self.id_str[:self.cursors["id"]])[0]
            visible_width_id = self.id_rect.width - 10
            scroll_id = self.scrolls.get("id", 0)
            if cursor_pixel_id - scroll_id > visible_width_id:
                self.scrolls["id"] = cursor_pixel_id - visible_width_id
            elif cursor_pixel_id - scroll_id < 0:
                self.scrolls["id"] = cursor_pixel_id

        elif self.editing_data:
            key = f"data{self.data_index}"
            active_str = self.data_str_c if self.data_index == 0 else self.data_str_r
            cursor_pos = self.cursors.get(key, len(active_str))

            if event.key == pygame.K_BACKSPACE:
                if cursor_pos > 0:
                    if self.data_index == 0:
                        self.data_str_c = self.data_str_c[:cursor_pos - 1] + self.data_str_c[cursor_pos:]
                    else:
                        self.data_str_r = self.data_str_r[:cursor_pos - 1] + self.data_str_r[cursor_pos:]
                    self.cursors[key] -= 1
            elif event.key == pygame.K_LEFT:
                self.cursors[key] = max(0, cursor_pos - 1)
            elif event.key == pygame.K_RIGHT:
                self.cursors[key] = min(len(active_str), cursor_pos + 1)
            else:
                if self.data_index == 0:
                    self.data_str_c = self.data_str_c[:cursor_pos] + event.unicode + self.data_str_c[cursor_pos:]
                else:
                    self.data_str_r = self.data_str_r[:cursor_pos] + event.unicode + self.data_str_r[cursor_pos:]
                self.cursors[key] += 1

            active_str = self.data_str_c if self.data_index == 0 else self.data_str_r
            active_rect = self.data_rect1 if self.data_index == 0 else self.data_rect2
            cursor_pixel = font.size(active_str[:self.cursors[key]])[0]
            visible_width = active_rect.width - 10
            scroll = self.scrolls.get(key, 0)

            if cursor_pixel - scroll > visible_width:
                self.scrolls[key] = cursor_pixel - visible_width
            elif cursor_pixel - scroll < 0:
                self.scrolls[key] = cursor_pixel

    def cancel(self):
        self.id_str = self.backup_id
        self.data_str_c = self.backup_data_c
        self.data_str_r = self.backup_data_r
        self.editing_id = False
        self.editing_data = False

    def confirm(self) -> bool:
        """Saves current fields to the global Draw finalization list, discarding if entirely empty."""
        global drawList
        if self.index < len(drawList):
            if self.id_str.strip() == "" and self.data_str_c.strip() == "" and self.data_str_r.strip() == "":
                drawList.pop(self.index)
            else:
                drawList[self.index] = (self.id_str, self.data_str_c, self.data_str_r)
        else:
            if self.id_str.strip() != "":
                drawList.append((self.id_str, self.data_str_c, self.data_str_r))

        self.backup_id = self.id_str
        self.backup_data_c = self.data_str_c
        self.backup_data_r = self.data_str_r
        self.editing_id = False
        self.editing_data = False

        update_functions()
        return True


def update_functions() -> None:
    """Rebuilds all dictionaries and runs error checking validation."""
    global functionsDict, colorsDict, restrictionsDict, drawFinal, error_states, color_error_states, \
        restriction_error_states, draw_error_states

    functionsDict.clear()
    error_states.clear()
    color_error_states.clear()
    restriction_error_states.clear()
    draw_error_states.clear()
    seen_ids = set()

    # --- 1. BUILD FUNCTIONS AND CHECK ERRORS ---
    for i, item in enumerate(functionsList):
        u_id, u_str = item[0], item[1]

        if not u_id:
            error_states[i] = (GREY, "")  # Grey (Empty)
            continue

        # Rule 1: NO Tildes in the declaration box!
        if ';' in u_id:
            error_states[i] = (RED,
                               "Variable names cannot contain ';'. Use ';' only when referencing them in equations.")
            continue  # Kill the ID

        # Rule 2: Duplicate Check
        if u_id in seen_ids:
            error_states[i] = (YELLOW, "Duplicate ID: Using the first declared value.")
            continue  # Skip adding to dict

        seen_ids.add(u_id)

        # Rule 3: Compile the math and check tree integrity
        eq = Equation(u_str)
        functionsDict[u_id] = eq

        # Check for Math Errors vs Size Warnings
        if eq.tree.op == 'invalid' or eq.tree.op == 'potato':
            error_states[i] = (RED, "Math Error: Invalid syntax or missing arguments.")
        elif eq.size(functionsDict, MAX_DEPTH) > 100:
            error_states[i] = (BLUE, "Warning: Large function tree. May impact performance.")
        else:
            error_states[i] = (GREEN, "Valid")

    # --- 2. BUILD SECONDARY DICTS ---
    colorsDict.clear()
    for i, item in enumerate(colorsList):

        if not item[0]:
            color_error_states[i] = (GREY, "")  # Grey (Empty)
            continue

        # Rule 1: NO Tildes in the declaration box!
        color_errs = []
        for n in range(1, 4):
            if item[n].strip() != "" and item[n] not in functionsDict:
                color_errs.append("Function ID not found")
                continue
        if item[0] in colorsDict:
            color_error_states[i] = (YELLOW, "Duplicate ID")
            continue

        if len(color_errs) > 0:
            color_error_states[i] = (RED, ", ".join(color_errs))
        else:
            c_r = Equation("x") if item[1].strip() == "" else functionsDict[item[1]]
            c_g = Equation("x") if item[2].strip() == "" else functionsDict[item[2]]
            c_b = Equation("x") if item[3].strip() == "" else functionsDict[item[3]]
            colorsDict[item[0]] = Color(c_r, c_g, c_b)
            color_error_states[i] = (GREEN, "Valid")

    restrictionsDict.clear()
    for i, x in enumerate(restrictionsList):
        if not x[0]:
            restriction_error_states[i] = (GREY, "")
            continue
        if x[0] in restrictionsDict:
            restriction_error_states[i] = (YELLOW, "Duplicate ID")
            continue
        if x[1].strip() != "" and x[1] not in functionsDict:
            restriction_error_states[i] = (RED, "Function ID not found")
        else:
            func_val = Equation("1") if x[1].strip() == "" else functionsDict[x[1]]
            restrictionsDict[x[0]] = Boundary(func_val, x[2])
            restriction_error_states[i] = (GREEN, "Valid")

    drawFinal.clear()
    for i, x in enumerate(drawList):
        if not x[0]:
            draw_error_states[i] = (GREY, "")
            continue

        errs = []
        if x[0] not in functionsDict:
            errs.append("Function ID not found")
        if x[1].strip() != "" and x[1] not in colorsDict:
            errs.append("Colour ID not found")
        if x[2].strip() != "" and x[2] not in restrictionsDict:
            errs.append("Restriction ID not found")

        if len(errs) > 0:
            draw_error_states[i] = (RED, ", ".join(errs))
        else:
            c_val = Color(Equation("x"), Equation("x"), Equation("x")) if x[1].strip() == "" else colorsDict[x[1]]
            r_val = Boundary(Equation("1"), False) if x[2].strip() == "" else restrictionsDict[x[2]]
            drawFinal.append((functionsDict[x[0]], c_val, r_val))
            draw_error_states[i] = (GREEN, "Valid")


def render_grid(surface: pygame.Surface, xpoints: list[float], ypoints: list[float]):
    """ renders the graph based on the values of xpoints and ypoints"""
    surface.fill((255, 255, 255))
    cell_w = (DRAW_MAX_X - DRAW_MIN_X) / len(xpoints)
    cell_h = (DRAW_MAX_Y - DRAW_MIN_Y) / len(ypoints)
    for i in range(len(xpoints)):
        for j in range(len(ypoints)):
            math_x = xpoints[i]
            math_y = ypoints[j]
            for curFunc in drawFinal:
                if curFunc[2].in_bounds(math_x, math_y, ANGLE_MODE, functionsDict, MAX_DEPTH):
                    z = curFunc[0].evaluate(math_x, math_y, ANGLE_MODE, functionsDict, MAX_DEPTH)
                    squarecolor = curFunc[1].get_color_tuple(z, ANGLE_MODE, functionsDict, MAX_DEPTH)
                    screen_x = round(DRAW_MIN_X + i * cell_w)
                    next_x = round(DRAW_MIN_X + (i + 1) * cell_w)

                    screen_y_top = round(DRAW_MAX_Y - ((j + 1) * cell_h))
                    screen_y_bottom = round(DRAW_MAX_Y - (j * cell_h))

                    rect_w = max(1, next_x - screen_x)
                    rect_h = max(1, screen_y_bottom - screen_y_top)
    # break it into x y components and then do a rectangle draw for each one to prevent the white lines from appearing
                    if squarecolor != (-1, -1, -1):
                        pygame.draw.rect(surface, squarecolor, (screen_x, screen_y_top, rect_w, rect_h))


# redraws the functions
def rerender_graph_surface(x_coords, y_coords):
    """
        renders the entire pygame surface
    """
    global GRAPH_SURFACE
    GRAPH_SURFACE = pygame.Surface((WIDTH, HEIGHT))
    GRAPH_SURFACE.fill((255, 255, 255))
    render_grid(GRAPH_SURFACE, x_coords, y_coords)


# Draws the top 5 label things
def render_tab_labels(screen: pygame.Surface, font: pygame.font.Font) -> None:
    """
        renders all the tabs labels and hitboxes
    """
    for i in range(len(PANELS)):
        rect = pygame.Rect(TABS_WIDTH * i, 0, TABS_WIDTH, TABS_HEIGHT)
        pygame.draw.rect(screen, (225, 225, 225), rect)
        if PANELS[i] == current_panel:
            pygame.draw.rect(screen, (180, 180, 180), rect)
        pygame.draw.rect(screen, (0, 0, 0), rect, 1)
        label = font.render(PANELS[i][:4], True, (0, 0, 0))
        screen.blit(label, (rect.x + 4, rect.y + 15))


# draws a button that you can click
def draw_button(screen: pygame.Surface, font: pygame.font.Font, rect: pygame.Rect, label: str) -> None:
    """
        draws the enter buttons
    """
    pygame.draw.rect(screen, (225, 225, 225), rect)
    pygame.draw.rect(screen, (70, 70, 70), rect, 2)
    text_surface = font.render(label, True, (0, 0, 0))
    text_rect = text_surface.get_rect(center=rect.center)
    screen.blit(text_surface, text_rect)


def build_export_string() -> str:
    """
    Serializes the current mathematical state (Functions, Colors, Restrictions, Draw, Settings)
    into a structured text block parseable by `import_from_string`.
    """
    function_lines = []
    color_lines = []
    restriction_lines = []
    draw_lines = []
    settings_lines = []

    # Functions
    for item_id, expr in functionsList:
        if item_id:
            function_lines.append(f"F:{item_id}~{expr}")

    # Colors
    for item_id, r_expr, g_expr, b_expr in colorsList:
        if item_id:
            color_lines.append(f"C:{item_id}~{r_expr}~{g_expr}~{b_expr}")

    # Restrictions
    for item_id, function_id, is_inverse in restrictionsList:
        if item_id:
            inverse_flag = "1" if is_inverse else "0"
            restriction_lines.append(f"R:{item_id}~{function_id}~{inverse_flag}")

    # Draw rows
    for function_id, color_id, restriction_id in drawList:
        if function_id or color_id or restriction_id:
            draw_lines.append(f"D~{function_id}~{color_id}~{restriction_id}")

    # Settings
    for key in ["x_min", "x_points", "x_max", "y_min", "y_points", "y_max", "max_recursion"]:
        settings_lines.append(f"S:{key}~{settings_values.get(key, '')}")

    settings_lines.append(f"S:angle_mode~{ANGLE_MODE}")

    sections = [
        "\n".join(function_lines),
        "\n".join(color_lines),
        "\n".join(restriction_lines),
        "\n".join(draw_lines),
        "\n".join(settings_lines)
    ]

    return "\n~~~~~\n".join(sections)


def _split_first(text: str, delimiter: str) -> tuple[str, str]:
    """Helper method to split a string strictly on its first identified delimiter."""
    parts = text.split(delimiter, 1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


def __sanitize_input(text: str) -> str:
    # First protect expected user newlines from Windows clipboards (CRLF)
    text = text.replace('\r\n', '\n')

    escapes = {
        '\a': 'a',
        '\b': 'b',
        '\f': 'f',
        '\r': 'r',
        '\t': 't',
        '\v': 'v'
    }
    for esc, repl in escapes.items():
        text = text.replace(esc, repl)
    text = text.replace('\\', '')
    return text


def import_from_string(raw_text: str) -> bool:
    """
    Read the import/export text and rebuild the lists/settings from it.

    Import format:
    F:id~expression
    C:id~r_expr~g_expr~b_expr
    R:id~function_id~0_or_1
    D~function_id~color_id~restriction_id
    S:key~value

    Important:
    If a record gets split across multiple physical lines during paste,
    any continuation lines are appended onto the previous record.
    """
    global functionsList, colorsList, restrictionsList, drawList
    global ANGLE_MODE
    global settings_transfer_status, settings_values, active_settings_field

    text = raw_text.strip()
    if not text:
        settings_transfer_status = "Import failed: empty text box."
        return False

    new_functions = []
    new_colors = []
    new_restrictions = []
    new_draw = []
    imported_settings = {}

    try:
        # ------------------------------------------
        # Step 1: rebuild wrapped records
        # ------------------------------------------
        # Only these prefixes can start a new record.
        record_prefixes = ("F:", "C:", "R:", "D~", "S:")

        logical_lines = []
        current_line = ""

        for raw_line in text.splitlines():
            line = raw_line.strip()

            # Skip blank lines and section separators
            if not line or line == "~~~~~":
                continue

            # If this line begins a new valid record, start a new logical line.
            if line.startswith(record_prefixes):
                if current_line:
                    logical_lines.append(current_line)
                current_line = line
            else:
                # Otherwise, this is treated as a continuation of the previous line.
                # We append it directly so pasted wrapped math expressions still work.
                if current_line:
                    current_line += line
                else:
                    raise ValueError(f"Unrecognized line: {line}")

        if current_line:
            logical_lines.append(current_line)

        # ------------------------------------------
        # Step 2: parse each rebuilt logical line
        # ------------------------------------------
        for line in logical_lines:
            left, right = _split_first(line, "~")
            left = left.strip()
            right = right.strip()

            # Function line: F:id~expression
            if left.startswith("F:"):
                item_id = left[2:].strip()
                new_functions.append((item_id, right))

            # Color line: C:id~r_expr~g_expr~b_expr
            elif left.startswith("C:"):
                item_id = left[2:].strip()
                parts = right.split("~", 2)
                if len(parts) != 3:
                    raise ValueError(f"Color '{item_id}' must be r~g~b.")
                new_colors.append((
                    item_id,
                    parts[0].strip(),
                    parts[1].strip(),
                    parts[2].strip()
                ))

            # Restriction line: R:id~function_id~0_or_1
            elif left.startswith("R:"):
                item_id = left[2:].strip()
                parts = right.split("~", 1)
                if len(parts) != 2:
                    raise ValueError(f"Restriction '{item_id}' must be function_id~0_or_1.")

                function_id = parts[0].strip()
                inverse_raw = parts[1].strip().lower()
                is_inverse = inverse_raw in {"1", "true", "t", "yes"}
                new_restrictions.append((item_id, function_id, is_inverse))

            # Draw line: D~function_id~color_id~restriction_id
            elif left == "D":
                parts = right.split("~", 2)
                if len(parts) != 3:
                    raise ValueError("Draw row must be function~color~restriction.")
                new_draw.append((
                    parts[0].strip(),
                    parts[1].strip(),
                    parts[2].strip()
                ))

            # Setting line: S:key~value
            elif left.startswith("S:"):
                setting_key = left[2:].strip()
                imported_settings[setting_key] = right

            else:
                raise ValueError(f"Unrecognized line: {line}")

        # ------------------------------------------
        # Step 3: apply imported data
        # ------------------------------------------
        functionsList = new_functions if new_functions else [("", "")]
        colorsList = new_colors if new_colors else [("", "", "", "")]
        restrictionsList = new_restrictions if new_restrictions else [("", "", False)]
        drawList = new_draw if new_draw else [("", "", "")]

        for key in ["x_min", "x_points", "x_max", "y_min", "y_points", "y_max", "max_recursion"]:
            if key in imported_settings:
                settings_values[key] = imported_settings[key]

        if "angle_mode" in imported_settings and imported_settings["angle_mode"] in {"radians", "degrees"}:
            ANGLE_MODE = imported_settings["angle_mode"]

        apply_settings_from_text()
        update_functions()

        active_settings_field = None
        settings_transfer_status = (
            f"Imported {len(functionsList)}F, {len(colorsList)}C, "
            f"{len(restrictionsList)}R, {len(drawList)}D."
        )
        return True

    except ValueError as exc:
        settings_transfer_status = f"Import failed: {exc}"
        return False
# (should probably use something similar to render_tab_labels and draw_button for this?)


# if you need to render a screen make the functions for that screen here
def render_settings_overlay(screen: pygame.Surface) -> None:
    """
    Draw the Settings tab UI inside the fixed left sidebar.

    This version also draws live textbox contents and stores the
    textbox/button rects so they can be clicked and edited.
    """
    global settings_buttons
    settings_buttons = {}

    if current_panel != 'Settings':
        return

    update_settings_error_states()

    panel_rect = pygame.Rect(0, TABS_HEIGHT, TEXTBOX_WIDTH, HEIGHT - TABS_HEIGHT)
    pygame.draw.rect(screen, (220, 230, 240), panel_rect)
    pygame.draw.rect(screen, (70, 70, 70), panel_rect, 1)

    sidebar_w = TEXTBOX_WIDTH
    sidebar_h = HEIGHT - TABS_HEIGHT

    margin_x = 18
    content_w = sidebar_w - 2 * margin_x

    title_font = pygame.font.SysFont(None, max(21, min(25, int(sidebar_h * 0.033))))
    label_font = pygame.font.SysFont(None, max(15, min(18, int(sidebar_h * 0.023))))
    small_label_font = pygame.font.SysFont(None, max(13, min(16, int(sidebar_h * 0.021))))
    button_font = pygame.font.SysFont(None, max(13, min(16, int(sidebar_h * 0.021))))
    text_font = pygame.font.SysFont(None, max(16, min(18, int(sidebar_h * 0.022))))

    section_gap = max(24, min(38, int(sidebar_h * 0.05)))
    row_gap = max(12, min(18, int(sidebar_h * 0.02)))

    col_gap = 10
    col_w = (content_w - 2 * col_gap) // 3

    box_w = max(54, min(84, col_w - 10))
    box_h = 26

    def draw_input_box(field_key: str, x: int, y: int, w: int = box_w, h: int = box_h) -> pygame.Rect:
        """
        Draw one editable settings textbox and its current contents.
        """
        rect = pygame.Rect(x, y, w, h)
        settings_buttons[field_key] = rect

        bg = (255, 255, 255) if active_settings_field == field_key else (235, 240, 246)
        pygame.draw.rect(screen, bg, rect)
        pygame.draw.rect(screen, (95, 95, 95), rect, 2)

        value = settings_values.get(field_key, "")
        text_surface = text_font.render(value, True, (0, 0, 0))
        scroll = settings_scrolls.get(field_key, 0)
        clip_area = pygame.Rect(scroll, 0, w - 10, h)
        screen.blit(text_surface, (rect.x + 5, rect.y + 5), clip_area)

        if active_settings_field == field_key:
            cursor_pos = settings_cursors.get(field_key, len(value))
            cursor_x = rect.x + 5 + text_font.size(value[:cursor_pos])[0] - scroll
            cursor_y = rect.y + 5
            pygame.draw.line(screen, (0, 0, 0), (cursor_x, cursor_y), (cursor_x, cursor_y + 16), 2)

        return rect

    def draw_confirm_button(button_key: str, field_key: str, x: int, y: int, w: int = 46, h: int = 24) -> pygame.Rect:
        """
        Draw a green ENTER button only when its matching textbox is active.
        """
        rect = pygame.Rect(x, y, w, h)
        settings_buttons[button_key] = rect

        # Only show this ENTER button if the user is currently editing this field
        if active_settings_field == field_key:
            pygame.draw.rect(screen, (100, 200, 100), rect)
            pygame.draw.rect(screen, (70, 70, 70), rect, 2)

            btn_txt = button_font.render("ENTER", True, (0, 0, 0))
            screen.blit(btn_txt, btn_txt.get_rect(center=rect.center))

        return rect

    def draw_settings_flag(field_key: str, cx: int, cy: int) -> None:
        """
        Draw a small colored status dot for one settings field.
        """
        color = settings_error_states.get(field_key, ((150, 150, 150), ""))[0]
        pygame.draw.circle(screen, color, (cx, cy), 6)

    def draw_axis_section(start_y: int, axis_label: str, prefix: str) -> int:
        """
        Draw one full axis section (X or Y).
        prefix should be 'x' or 'y' so keys become x_min, x_points, x_max...
        """
        screen.blit(title_font.render(f"{axis_label} axis:", True, (0, 0, 0)), (margin_x, start_y))

        label_y = start_y + 34
        box_y = label_y + 26
        enter_y = box_y + box_h + 12

        col1_x = margin_x
        col2_x = margin_x + col_w + col_gap
        col3_x = margin_x + 2 * (col_w + col_gap)

        screen.blit(label_font.render("Lower bound:", True, (0, 0, 0)), (col1_x, label_y))
        screen.blit(label_font.render("# of points:", True, (0, 0, 0)), (col2_x, label_y))
        screen.blit(label_font.render("Upper bound:", True, (0, 0, 0)), (col3_x, label_y))

        box1_x = col1_x + (col_w - box_w) // 2
        box2_x = col2_x + (col_w - box_w) // 2
        box3_x = col3_x + (col_w - box_w) // 2

        draw_input_box(f"{prefix}_min", box1_x, box_y)
        draw_input_box(f"{prefix}_points", box2_x, box_y)
        draw_input_box(f"{prefix}_max", box3_x, box_y)

        # Small colored flags beside each textbox
        draw_settings_flag(f"{prefix}_min", box1_x - 10, box_y + box_h // 2)
        draw_settings_flag(f"{prefix}_points", box2_x - 10, box_y + box_h // 2)
        draw_settings_flag(f"{prefix}_max", box3_x - 10, box_y + box_h // 2)

        enter_w = 46
        enter_h = 24
        draw_confirm_button(f"{prefix}_min_enter", f"{prefix}_min", box1_x + (box_w - enter_w) // 2, enter_y, enter_w,
                            enter_h)
        draw_confirm_button(f"{prefix}_points_enter", f"{prefix}_points", box2_x + (box_w - enter_w) // 2, enter_y,
                            enter_w, enter_h)
        draw_confirm_button(f"{prefix}_max_enter", f"{prefix}_max", box3_x + (box_w - enter_w) // 2, enter_y, enter_w,
                            enter_h)

        return enter_y + enter_h + section_gap

    def draw_current_mode_row(y: int) -> int:
        """
        Draw current angle mode on the left and a mode-toggle button on the right.
        """
        left_x = margin_x
        control_w = 96
        control_h = 32
        control_x = sidebar_w - margin_x - control_w

        screen.blit(label_font.render("Current mode:", True, (0, 0, 0)), (left_x, y))
        screen.blit(label_font.render(ANGLE_MODE, True, (0, 0, 0)), (left_x, y + 20))

        button_text = "Use degrees" if ANGLE_MODE == "radians" else "Use radians"

        btn_rect = pygame.Rect(control_x, y + 1, control_w, control_h)
        settings_buttons["angle_toggle"] = btn_rect
        draw_button(screen, button_font, btn_rect, button_text)

        return y + 44

    def draw_max_depth_row(y: int) -> int:
        """
        Draw max recursive depth row with editable box and ENTER button.
        """
        left_x = margin_x

        screen.blit(small_label_font.render("Maximum recursive", True, (0, 0, 0)), (left_x, y + 2))
        screen.blit(small_label_font.render("depth:", True, (0, 0, 0)), (left_x, y + 18))

        input_w = 52
        input_h = 28
        enter_w = 46
        enter_h = 24
        gap = 8
        right_margin = 12

        enter_x = sidebar_w - right_margin - enter_w
        box_x = enter_x - gap - input_w
        box_y = y + 8

        draw_input_box("max_recursion", box_x, box_y, input_w, input_h)
        draw_settings_flag("max_recursion", box_x - 10, box_y + input_h // 2)
        draw_confirm_button("max_recursion_enter", "max_recursion", enter_x, box_y + (input_h - enter_h) // 2, enter_w,
                            enter_h)

        return y + 48

    current_y = TABS_HEIGHT + 14
    current_y = draw_axis_section(current_y, "X", "x")
    current_y = draw_axis_section(current_y, "Y", "y")
    current_y += 2
    current_y = draw_current_mode_row(current_y)
    current_y += row_gap
    current_y = draw_max_depth_row(current_y + 4)

    # -----------------------------
    # Import / Export section
    # -----------------------------
    transfer_top = max(current_y + 10, HEIGHT - 165)
    screen.blit(label_font.render("Import / Export:", True, (0, 0, 0)), (margin_x, transfer_top))

    # Main text area that shows exported text or accepts pasted text
    transfer_rect = pygame.Rect(margin_x, transfer_top + 24, content_w, 40)
    settings_buttons["transfer_text"] = transfer_rect

    pygame.draw.rect(
        screen,
        (255, 255, 255) if active_settings_field == "transfer_text" else (235, 240, 246),
        transfer_rect
    )
    pygame.draw.rect(screen, (95, 95, 95), transfer_rect, 2)

    # Show a short preview of the transfer text
    # Replace line breaks with spaces so the preview stays on one visual line
    preview_text = settings_transfer_text.replace("\n", " ")

    # Render the full preview text
    preview_surface = small_label_font.render(preview_text, True, (0, 0, 0))

    # Clip the text so it cannot draw outside the textbox
    preview_clip = pygame.Rect(
        transfer_rect.x + 5,
        transfer_rect.y + 4,
        transfer_rect.width - 10,
        16
    )
    screen.blit(preview_surface, (transfer_rect.x + 5, transfer_rect.y + 4),
                area=pygame.Rect(0, 0, preview_clip.width, preview_clip.height))

    # Helper text
    screen.blit(
        small_label_font.render("Export copies out. Import reads from clipboard.", True, (80, 80, 80)),
        (transfer_rect.x + 5, transfer_rect.y + 22)
    )

    # Buttons under the text area
    button_y = transfer_rect.y + transfer_rect.height + 8
    settings_buttons["export_text"] = pygame.Rect(margin_x, button_y, 80, 26)
    settings_buttons["import_text"] = pygame.Rect(margin_x + 92, button_y, 80, 26)

    # Export copies the generated string to the device clipboard
    # Import reads text from the device clipboard into the textbox and imports it
    draw_button(screen, button_font, settings_buttons["export_text"], "Export")
    draw_button(screen, button_font, settings_buttons["import_text"], "Import")

    if settings_transfer_status:
        # Shorten long status text so it fits in the sidebar
        status_text = settings_transfer_status
        max_width = content_w

        while status_text and small_label_font.size(status_text)[0] > max_width:
            status_text = status_text[:-1]

        if status_text != settings_transfer_status and len(status_text) >= 3:
            status_text = status_text[:-3] + "..."

        status_surface = small_label_font.render(status_text, True, (40, 40, 40))
        screen.blit(status_surface, (margin_x, button_y + 32))


def apply_settings_from_text() -> None:
    """
    Read the text from the Settings tab textboxes and apply them.

    Large grids are allowed.
    Only clamp when total grid points exceed MAX_TOTAL_GRID_POINTS.

    If the total is too large, clamp the field the user is currently editing.
    """
    global X_GRID_RESOLUTION, X_MATH_MIN, X_MATH_MAX
    global Y_GRID_RESOLUTION, Y_MATH_MIN, Y_MATH_MAX
    global xstep, ystep, x_coords, y_coords, MAX_DEPTH

    try:
        new_x_min = float(settings_values["x_min"])
        new_x_max = float(settings_values["x_max"])
        new_x_points = int(settings_values["x_points"])

        new_y_min = float(settings_values["y_min"])
        new_y_max = float(settings_values["y_max"])
        new_y_points = int(settings_values["y_points"])

        new_max_depth = int(settings_values["max_recursion"])

        if new_x_points <= 0 or new_y_points <= 0:
            update_settings_error_states()
            return
        if new_x_min >= new_x_max or new_y_min >= new_y_max:
            update_settings_error_states()
            return
        if new_max_depth < 0:
            update_settings_error_states()
            return

        total_points = new_x_points * new_y_points

        if total_points > MAX_TOTAL_GRID_POINTS:
            # Clamp whichever field is currently being edited
            if active_settings_field == "x_points":
                new_x_points = max(1, MAX_TOTAL_GRID_POINTS // new_y_points)
            elif active_settings_field == "y_points":
                new_y_points = max(1, MAX_TOTAL_GRID_POINTS // new_x_points)
            else:
                # fallback: clamp y if we don't know which one caused it
                new_y_points = max(1, MAX_TOTAL_GRID_POINTS // new_x_points)

            # Sync the textboxes to the clamped values
            settings_values["x_points"] = str(new_x_points)
            settings_values["y_points"] = str(new_y_points)

        X_MATH_MIN = new_x_min
        X_MATH_MAX = new_x_max
        X_GRID_RESOLUTION = new_x_points

        Y_MATH_MIN = new_y_min
        Y_MATH_MAX = new_y_max
        Y_GRID_RESOLUTION = new_y_points

        MAX_DEPTH = new_max_depth
        settings_values["max_recursion"] = str(MAX_DEPTH)

        xstep = (X_MATH_MAX - X_MATH_MIN) / X_GRID_RESOLUTION
        ystep = (Y_MATH_MAX - Y_MATH_MIN) / Y_GRID_RESOLUTION

        x_coords = [X_MATH_MIN + 1 + i * xstep for i in range(X_GRID_RESOLUTION)]
        y_coords = [Y_MATH_MIN + j * ystep for j in range(Y_GRID_RESOLUTION)]

        update_settings_error_states()
        calculate_draw_bounds(X_MATH_MAX - X_MATH_MIN, Y_MATH_MAX - Y_MATH_MIN)
        rerender_graph_surface(x_coords, y_coords)

    except ValueError:
        update_settings_error_states()


def handle_settings_textbox_click(mouse_pos) -> None:
    """Sets focus on the clicked settings textbox and computes text cursor position."""
    global active_settings_field

    textbox_keys = [
        "x_min", "x_points", "x_max",
        "y_min", "y_points", "y_max",
        "max_recursion"
        ]

    active_settings_field = None
    for key in textbox_keys:
        if key in settings_buttons and settings_buttons[key].collidepoint(mouse_pos):
            active_settings_field = key
            if key in settings_values:  # exclude transfer text
                value = settings_values.get(key, "")
                scroll = settings_scrolls.get(key, 0)
                rect = settings_buttons[key]
                cursor_pos_x = mouse_pos[0] - (rect.x + 5) + scroll
                font_widths = [font.size(value[:i])[0] for i in range(len(value) + 1)]
                settings_cursors[key] = min(range(len(font_widths)), key=lambda i: abs(font_widths[i] - cursor_pos_x))

                cursor_pixel = font.size(value[:settings_cursors[key]])[0]
                if cursor_pixel > rect.width - 10:
                    settings_scrolls[key] = cursor_pixel - (rect.width - 10)
                else:
                    settings_scrolls[key] = 0
            break


def handle_settings_keydown(event) -> None:
    """Processes character typing, backspaces, and autoscrolling for active settings textboxes."""
    global active_settings_field, settings_transfer_text, settings_transfer_status

    if active_settings_field is None:
        return

    # -----------------------------------------
    # Normal numeric settings boxes
    # -----------------------------------------
    if event.key == pygame.K_RETURN:
        apply_settings_from_text()
        active_settings_field = None
        update_settings_error_states()
        return

    if event.key == pygame.K_ESCAPE:
        active_settings_field = None
        update_settings_error_states()
        return

    value = settings_values[active_settings_field]
    cursor_pos = settings_cursors.get(active_settings_field, len(value))

    if event.key == pygame.K_BACKSPACE:
        if cursor_pos > 0:
            settings_values[active_settings_field] = value[:cursor_pos - 1] + value[cursor_pos:]
            settings_cursors[active_settings_field] = cursor_pos - 1
            update_settings_error_states()
    elif event.key == pygame.K_LEFT:
        settings_cursors[active_settings_field] = max(0, cursor_pos - 1)
    elif event.key == pygame.K_RIGHT:
        settings_cursors[active_settings_field] = min(len(value), cursor_pos + 1)
    else:
        allowed_chars = "0123456789.-"
        if event.unicode in allowed_chars:
            settings_values[active_settings_field] = value[:cursor_pos] + event.unicode + value[cursor_pos:]
            settings_cursors[active_settings_field] = cursor_pos + 1
            update_settings_error_states()

    # Autoscroll
    value = settings_values[active_settings_field]
    cursor_pixel = font.size(value[:settings_cursors[active_settings_field]])[0]
    rect_width = settings_buttons[active_settings_field].width
    visible_width = rect_width - 10
    scroll = settings_scrolls.get(active_settings_field, 0)

    if cursor_pixel - scroll > visible_width:
        settings_scrolls[active_settings_field] = cursor_pixel - visible_width
    elif cursor_pixel - scroll < 0:
        settings_scrolls[active_settings_field] = cursor_pixel


def update_settings_error_states() -> None:
    """
    Rebuild the color state for settings fields.

    Meanings:
    - Red: invalid
    - Blue: warning
    - Green: normal valid
    - Grey: blank / can't evaluate yet
    """
    global settings_error_states
    settings_error_states = {}

    keys = ["x_min", "x_points", "x_max", "y_min", "y_points", "y_max", "max_recursion"]

    for key in keys:
        settings_error_states[key] = (GREY, "")

    # X bounds
    try:
        x_min = float(settings_values["x_min"])
        x_max = float(settings_values["x_max"])
        if x_min > x_max:
            settings_error_states["x_min"] = (RED, "Lower bound is greater than upper bound.")
            settings_error_states["x_max"] = (RED, "Upper bound is less than lower bound.")
        else:
            settings_error_states["x_min"] = (GREEN, "Valid")
            settings_error_states["x_max"] = (GREEN, "Valid")
    except ValueError:
        pass

    # Y bounds
    try:
        y_min = float(settings_values["y_min"])
        y_max = float(settings_values["y_max"])
        if y_min > y_max:
            settings_error_states["y_min"] = (RED, "Lower bound is greater than upper bound.")
            settings_error_states["y_max"] = (RED, "Upper bound is less than lower bound.")
        else:
            settings_error_states["y_min"] = (GREEN, "Valid")
            settings_error_states["y_max"] = (GREEN, "Valid")
    except ValueError:
        pass

    # X points
    try:
        x_points = int(settings_values["x_points"])
        if x_points > 0:
            settings_error_states["x_points"] = (GREEN, "Valid")
    except ValueError:
        pass

    # Y points
    try:
        y_points = int(settings_values["y_points"])
        if y_points > 0:
            settings_error_states["y_points"] = (GREEN, "Valid")
    except ValueError:
        pass

    # Total grid size warning / hard max
    try:
        x_points = int(settings_values["x_points"])
        y_points = int(settings_values["y_points"])
        total_points = x_points * y_points

        if x_points > 0 and y_points > 0:
            if total_points > MAX_TOTAL_GRID_POINTS:
                settings_error_states["x_points"] = (BLUE, "Total grid exceeds hard limit and will be clamped.")
                settings_error_states["y_points"] = (BLUE, "Total grid exceeds hard limit and will be clamped.")
            elif total_points > WARNING_TOTAL_GRID_POINTS:
                settings_error_states["x_points"] = (BLUE, "Total grid is very large.")
                settings_error_states["y_points"] = (BLUE, "Total grid is very large.")
    except ValueError:
        pass

    # Max recursion
    try:
        max_depth = int(settings_values["max_recursion"])
        if max_depth < 0:
            settings_error_states["max_recursion"] = (GREY, "")
        elif max_depth < 3 or max_depth > 20:
            settings_error_states["max_recursion"] = (BLUE, "Recursion depth is outside the normal range.")
        else:
            settings_error_states["max_recursion"] = (GREEN, "Valid")
    except ValueError:
        pass


def apply_screen_size_from_index(index: int, xrange: float, yrange: float) -> None:
    """ takes in an index and based off of that, it calls the funtion calculate_draw_bounds with new screen bounds"""
    global SCREEN_SIZE_INDEX, WIDTH, HEIGHT
    SCREEN_SIZE_INDEX = index % len(SCREEN_SIZE_OPTIONS)
    WIDTH, HEIGHT = SCREEN_SIZE_OPTIONS[SCREEN_SIZE_INDEX]
    calculate_draw_bounds(xrange, yrange)


# --- MAIN EXECUTION ---
if __name__ == "__main__":
    import doctest
    doctest.testmod(verbose=True)

    import python_ta
    python_ta.check_all(config={
        'max-line-length': 120
    })

    X_GRID_RESOLUTION = 100
    X_MATH_MIN, X_MATH_MAX = -15.0, 15.0
    Y_GRID_RESOLUTION = 100
    Y_MATH_MIN, Y_MATH_MAX = -15.0, 15.0
    calculate_draw_bounds(X_MATH_MAX - X_MATH_MIN, Y_MATH_MAX - Y_MATH_MIN)
    screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)

    pygame.display.set_caption("Render Engine")

    settings_values["x_min"] = str(X_MATH_MIN)
    settings_values["x_points"] = str(X_GRID_RESOLUTION)
    settings_values["x_max"] = str(X_MATH_MAX)
    settings_values["y_min"] = str(Y_MATH_MIN)
    settings_values["y_points"] = str(Y_GRID_RESOLUTION)
    settings_values["y_max"] = str(Y_MATH_MAX)
    settings_values["max_recursion"] = str(MAX_DEPTH)
    update_settings_error_states()
    xstep = (X_MATH_MAX - X_MATH_MIN) / X_GRID_RESOLUTION
    # HOLY SHIT IS THAT A GEOMETRY DASH REFERENCE???????????
    ystep = (Y_MATH_MAX - Y_MATH_MIN) / Y_GRID_RESOLUTION
    x_coords = [X_MATH_MIN + 1 + i * xstep for i in range(X_GRID_RESOLUTION)]
    y_coords = [Y_MATH_MIN + j * ystep for j in range(Y_GRID_RESOLUTION)]

    # Generate a static surface to hold the math grid so UI doesn't lag

    update_functions()
    if len(functionsList) > 0:
        AST_SELECTED_ID = functionsList[0][0]
    rerender_graph_surface(x_coords, y_coords)

    function_ui_fields = [FunctionsEntryField(i, functionsList) for i in range(len(functionsList) + 1)]
    colors_ui_fields = [ColorsEntryField(i, colorsList) for i in range(len(colorsList) + 1)]
    rest_ui_fields = [RestrictionsEntryField(i, restrictionsList) for i in range(len(restrictionsList) + 1)]
    draw_ui_fields = [DrawEntryField(i, drawList) for i in range(len(drawList) + 1)]

    running = True
    while running:
        # 1. ALWAYS BLIT THE CACHED MATH GRID FIRST
        if GRAPH_SURFACE is not None:
            screen.blit(GRAPH_SURFACE, (0, 0))  # graph surface is always going to be none because of the if statement

        pygame.draw.rect(screen, (220, 220, 220), (0, TABS_HEIGHT, TEXTBOX_WIDTH, HEIGHT))
        # 3. HANDLE EVENTS
        for event in pygame.event.get():

            if event.type == pygame.QUIT:
                running = False

            if event.type == pygame.VIDEORESIZE:
                WIDTH, HEIGHT = event.w, event.h
                calculate_draw_bounds(X_MATH_MAX - X_MATH_MIN, Y_MATH_MAX - Y_MATH_MIN)  # Recalculate aspect ratio
                screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
                rerender_graph_surface(x_coords, y_coords)

            if event.type == pygame.MOUSEBUTTONDOWN:
                mouse_pos = pygame.mouse.get_pos()

                for i in range(5):
                    if pygame.Rect(TABS_WIDTH * i, 0, TABS_WIDTH, TABS_HEIGHT).collidepoint(mouse_pos):
                        current_panel = PANELS[i]
                        break

                # Check if user clicked inside any UI field
                if current_panel == 'Functions':
                    if event.button == 4:        # scroll up
                        scroll_y_vals[0] -= 5
                    elif event.button == 5:        # scroll down
                        scroll_y_vals[0] = min(0, scroll_y_vals[0] + 5)

                    clicked_any_field = False

                    for field in function_ui_fields:
                        if field.rect.collidepoint(mouse_pos):
                            clicked_any_field = True
                            needs_redraw = field.handle_click(mouse_pos)

                            # If confirmed, recalculate grid and regenerate UI list to add the next empty block
                            if needs_redraw:
                                print("Recalculating Math...")

                                rerender_graph_surface(x_coords, y_coords)
                                function_ui_fields = [FunctionsEntryField(i, functionsList)
                                                      for i in range(len(functionsList) + 1)]

                        else:
                            # If they clicked another field, cancel the edit on this one
                            if field.editing_id or field.editing_data:
                                field.cancel()

                    # If they clicked entirely outside the UI sidebar, cancel everything
                    if not clicked_any_field:
                        for field in function_ui_fields:
                            field.cancel()

                # colors mouse inputs,
                if current_panel == 'Colors':
                    if event.button == 4:       # scroll up
                        scroll_y_vals[1] -= 5
                    elif event.button == 5:     # scroll down
                        scroll_y_vals[1] = min(0, scroll_y_vals[1] + 5)

                    clicked_any_field = False
                    for field in colors_ui_fields:
                        if field.rect.collidepoint(mouse_pos):
                            clicked_any_field = True
                            needs_redraw = field.handle_click(mouse_pos)
                            if needs_redraw:
                                rerender_graph_surface(x_coords, y_coords)
                                colors_ui_fields = [ColorsEntryField(i, colorsList) for i in range(len(colorsList) + 1)]
                        else:
                            if field.editing_id or field.editing_data:
                                field.cancel()
                    if not clicked_any_field:
                        for field in colors_ui_fields:
                            field.cancel()

                if current_panel == 'Restrictions':
                    if event.button == 4:       # scroll up
                        scroll_y_vals[2] -= 5
                    elif event.button == 5:     # scroll down
                        scroll_y_vals[2] = min(0, scroll_y_vals[2] + 5)

                    clicked_any_field = False
                    for field in rest_ui_fields:
                        if field.rect.collidepoint(mouse_pos):
                            clicked_any_field = True
                            needs_redraw = field.handle_click(mouse_pos)
                            if needs_redraw:
                                calculate_draw_bounds(X_MATH_MAX - X_MATH_MIN, Y_MATH_MAX - Y_MATH_MIN)
                                rerender_graph_surface(x_coords, y_coords)
                                rest_ui_fields = [RestrictionsEntryField(i, restrictionsList)
                                                  for i in range(len(restrictionsList) + 1)]
                        else:
                            if field.editing_id or getattr(field, 'editing_data', False):
                                field.cancel()
                    if not clicked_any_field:
                        for field in rest_ui_fields:
                            field.cancel()

                if current_panel == 'Draw':
                    if event.button == 4:       # scroll up
                        scroll_y_vals[3] -= 5
                    elif event.button == 5:     # scroll down
                        scroll_y_vals[3] = min(0, scroll_y_vals[3] + 5)

                    clicked_any_field = False
                    for field in draw_ui_fields:
                        if field.rect.collidepoint(mouse_pos):
                            clicked_any_field = True
                            needs_redraw = field.handle_click(mouse_pos)
                            if needs_redraw:
                                calculate_draw_bounds(X_MATH_MAX - X_MATH_MIN, Y_MATH_MAX - Y_MATH_MIN)
                                rerender_graph_surface(x_coords, y_coords)
                                draw_ui_fields = [DrawEntryField(i, drawList) for i in range(len(drawList) + 1)]
                        else:
                            if field.editing_id or getattr(field, 'editing_data', False):
                                field.cancel()
                    if not clicked_any_field:
                        for field in draw_ui_fields:
                            field.cancel()

                if current_panel == 'Settings':

                    # ---------------------------------
                    # Import / Export buttons
                    # ---------------------------------

                    # Export current state to the device clipboard and show it in the textbox
                    if settings_buttons.get("export_text") and settings_buttons["export_text"].collidepoint(mouse_pos):
                        settings_transfer_text = build_export_string()

                        try:
                            pyperclip.copy(settings_transfer_text)
                            settings_transfer_status = "Exported to clipboard."
                        except pyperclip.PyperclipException:
                            settings_transfer_status = "Clipboard export failed."

                        active_settings_field = None
                        continue

                    # Import reads from the device clipboard, shows it in the textbox, and imports it
                    if settings_buttons.get("import_text") and settings_buttons["import_text"].collidepoint(mouse_pos):
                        try:
                            clip_text = pyperclip.paste()

                            if not clip_text:
                                settings_transfer_status = "Clipboard is empty."
                            else:
                                settings_transfer_text = __sanitize_input(clip_text)

                    # Import from the current transfer text
                            if (settings_buttons.get("import_text") and
                                    settings_buttons["import_text"].collidepoint(mouse_pos)):
                                if import_from_string(settings_transfer_text):
                                    # Rebuild UI rows so the imported data shows up immediately
                                    function_ui_fields = [FunctionsEntryField(i, functionsList)
                                                          for i in range(len(functionsList) + 1)]
                                    colors_ui_fields = [ColorsEntryField(i, colorsList)
                                                        for i in range(len(colorsList) + 1)]

                                    rest_ui_fields = [RestrictionsEntryField(i, restrictionsList)
                                                      for i in range(len(restrictionsList) + 1)]
                                    draw_ui_fields = [DrawEntryField(i, drawList) for i in range(len(drawList) + 1)]

                                    rerender_graph_surface(x_coords, y_coords)

                        except pyperclip.PyperclipException:
                            settings_transfer_status = "Clipboard import failed."

                        active_settings_field = None
                        continue

                    # 1. First check the ENTER button for the currently active field
                    if active_settings_field is not None:
                        active_enter_key = f"{active_settings_field}_enter"
                        if settings_buttons.get(active_enter_key) and settings_buttons[active_enter_key].collidepoint(
                                mouse_pos):
                            calculate_draw_bounds(X_MATH_MAX - X_MATH_MIN, Y_MATH_MAX - Y_MATH_MIN)
                            apply_settings_from_text()
                            active_settings_field = None
                            continue

                    # 2. Then check angle toggle
                    if settings_buttons.get("angle_toggle") and settings_buttons["angle_toggle"].collidepoint(
                            mouse_pos):
                        ANGLE_MODE = "degrees" if ANGLE_MODE == "radians" else "radians"
                        update_functions()
                        rerender_graph_surface(x_coords, y_coords)
                        active_settings_field = None
                        continue

                    # 3. Finally, if none of the above were clicked, activate a textbox
                    handle_settings_textbox_click(mouse_pos)

            if event.type == pygame.KEYDOWN:
                allowed_keys = [pygame.K_BACKSPACE, pygame.K_LEFT, pygame.K_RIGHT, pygame.K_RETURN]
                if event.key not in allowed_keys and (event.unicode == ""):
                    continue
                if hasattr(event, 'unicode'):
                    try:
                        event.unicode = __sanitize_input(event.unicode)
                    except AttributeError:
                        pass

                if current_panel == 'Functions':
                    for field in function_ui_fields:
                        field.handle_keydown(event)
                elif current_panel == 'Colors':
                    for field in colors_ui_fields:
                        field.handle_keydown(event)
                elif current_panel == 'Restrictions':
                    for field in rest_ui_fields:
                        field.handle_keydown(event)
                elif current_panel == 'Draw':
                    for field in draw_ui_fields:
                        field.handle_keydown(event)
                elif current_panel == 'Settings':
                    handle_settings_keydown(event)

        # 4. DRAW APPROPRIATE UI OVERLAYS
        if current_panel == 'Functions':
            for field in function_ui_fields:
                field.draw(screen)

        elif current_panel == 'Colors':
            for field in colors_ui_fields:
                field.draw(screen)

        elif current_panel == 'Restrictions':
            for field in rest_ui_fields:
                field.draw(screen)

        elif current_panel == 'Draw':
            for field in draw_ui_fields:
                field.draw(screen)

        elif current_panel == 'Settings':
            render_settings_overlay(screen)

        # 2. DRAW UI TABS AND ACTIVE PANEL BACKGROUND
        render_tab_labels(screen, font)

        pygame.display.flip()
    pygame.quit()
    sys.exit()
